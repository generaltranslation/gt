import { parse } from '@babel/parser';
import traverseModule, { type NodePath } from '@babel/traverse';
import generateModule from '@babel/generator';
import * as t from '@babel/types';
import {
  isTagElement,
  parse as parseIcu,
  type MessageFormatElement,
} from '@formatjs/icu-messageformat-parser';
import { classifyMessage } from '../classifyMessage.js';
import { ensureNamedImports } from '../importUtils.js';
import type { TransformOptions } from '../transformSource.js';
import type { MigrationContext, SourceResult, TodoEntry } from '../types.js';

const traverse = traverseModule.default || traverseModule;
const generate = generateModule.default || generateModule;

const MODULE = 'react-intl';
const GT_MODULE = 'gt-next';
const GT_SERVER_MODULE = 'gt-next/server';

/** react-intl symbols this adapter knows how to convert or unwrap. Everything
 *  else imported from react-intl forces a whole-file skip (graceful, reported),
 *  mirroring #1910's contract. */
const SUPPORTED_IMPORTS = new Set([
  'useIntl',
  'IntlProvider',
  'FormattedMessage',
  'FormattedNumber',
  'FormattedDate',
  'FormattedTime',
  'FormattedPlural',
  'FormattedRelativeTime',
  'defineMessages',
  'defineMessage',
  'createIntl',
  'createIntlCache',
]);

/** Value-formatter components mapped to a gt-next component whose formatted
 *  value is passed as children (`<Num>{value}</Num>`). */
const CHILD_VALUE_FORMATTERS: Record<
  string,
  { target: string; defaultOptions?: Record<string, string> }
> = {
  FormattedNumber: { target: 'Num' },
  FormattedDate: { target: 'DateTime' },
  // react-intl's <FormattedTime> defaults to { hour, minute }; gt-next's
  // <DateTime> has no time default, so make it explicit.
  FormattedTime: {
    target: 'DateTime',
    defaultOptions: { hour: 'numeric', minute: 'numeric' },
  },
};

/** JSX attribute names that carry a plural/select category on <FormattedPlural>
 *  and survive verbatim onto gt-next's <Plural>. */
const PLURAL_CATEGORIES = new Set([
  'zero',
  'one',
  'two',
  'few',
  'many',
  'other',
]);

type PlannedRich = {
  container: NodePath<t.JSXExpressionContainer> | NodePath<t.JSXElement>;
  elements: MessageFormatElement[];
  chunkMap: Map<string, t.JSXElement>;
};

/**
 * react-intl -> gt-next per-file transform. Dictionary-compat by default:
 * `intl.formatMessage({ id }, values)` -> `t(id, values)`, `<FormattedMessage
 * id />` -> `{t(id, values)}`, value formatters -> gt-next components, catalogs
 * reused verbatim. Rich-text tags only convert under --inline (lossy, reported);
 * unsupported APIs skip the whole file and are reported. The provider is
 * unwrapped (gt-next's server GTProvider is inserted by the layout pass), or
 * retained untouched while skipped files remain.
 */
export function transformReactIntlSource(
  file: string,
  code: string,
  ctx: MigrationContext,
  options: TransformOptions
): SourceResult {
  const none: SourceResult = {
    code: null,
    todos: [],
    skipReasons: [],
    usedRich: false,
  };
  if (!/['"](react-intl|@formatjs\/[^'"]*)['"]/.test(code)) return none;

  let ast: t.File;
  try {
    ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
      tokens: true,
      createParenthesizedExpressions: true,
    });
  } catch (error) {
    return {
      ...none,
      skipReasons: [`file could not be parsed: ${String(error)}`],
    };
  }

  const retainProvider = options.retainNextIntlProvider === true;
  const skipReasons: string[] = [];
  const todos: TodoEntry[] = [];

  // ---- imports -------------------------------------------------------------

  type ImportedSymbol = {
    imported: string;
    local: string;
    specifier: t.ImportSpecifier;
  };
  const symbols: ImportedSymbol[] = [];
  const reactIntlImports: NodePath<t.ImportDeclaration>[] = [];
  traverse(ast, {
    ImportDeclaration(path) {
      const source = path.node.source.value;
      if (source !== MODULE && !source.startsWith('@formatjs/')) return;
      reactIntlImports.push(path);
      for (const specifier of path.node.specifiers) {
        if (!t.isImportSpecifier(specifier)) {
          skipReasons.push(
            `unsupported react-intl import form from '${source}'`
          );
          continue;
        }
        const imported = t.isIdentifier(specifier.imported)
          ? specifier.imported.name
          : specifier.imported.value;
        symbols.push({ imported, local: specifier.local.name, specifier });
        // @formatjs/* deep imports are advanced runtime wiring with no v1 map.
        if (source.startsWith('@formatjs/')) {
          skipReasons.push(
            `unsupported react-intl API: ${imported} (from '${source}') — advanced @formatjs usage has no v1 gt-next mapping`
          );
        } else if (!SUPPORTED_IMPORTS.has(imported)) {
          skipReasons.push(reasonForUnsupported(imported, source));
        }
      }
    },
  });
  if (reactIntlImports.length === 0) return none;

  const localsOf = (name: string) =>
    new Set(symbols.filter((s) => s.imported === name).map((s) => s.local));
  const useIntlLocals = localsOf('useIntl');
  const createIntlLocals = localsOf('createIntl');
  const createIntlCacheLocals = localsOf('createIntlCache');
  const defineMessagesLocals = new Set([
    ...localsOf('defineMessages'),
    ...localsOf('defineMessage'),
  ]);
  const providerLocals = localsOf('IntlProvider');
  const formattedMessageLocals = localsOf('FormattedMessage');
  // Value-formatter components mapped from their local (alias-aware) name to the
  // canonical react-intl name, so `<FormattedNumber as FN>` still converts.
  const formatterLocals = new Map<string, string>();
  for (const symbol of symbols) {
    if (
      CHILD_VALUE_FORMATTERS[symbol.imported] ||
      symbol.imported === 'FormattedPlural' ||
      symbol.imported === 'FormattedRelativeTime'
    ) {
      formatterLocals.set(symbol.local, symbol.imported);
    }
  }

  // ---- analysis ------------------------------------------------------------

  // `const M = defineMessages({ key: { id }, ... })` descriptor tables, so
  // `M.key` in a formatMessage call resolves to its literal id.
  const descriptorTables = new Map<string, Map<string, string>>();
  // bindings that hold an intl object (useIntl() client, createIntl() server).
  const intlBindings = new Map<string, 'client' | 'server'>();
  const intlBindingFns = new Map<string, t.Function | null>();
  // client `const intl = useIntl()` declarators, rewritten to useTranslations().
  const useIntlDecls: NodePath<t.VariableDeclarator>[] = [];
  const createIntlDecls: {
    declarator: NodePath<t.VariableDeclarator>;
    fn: t.Function | null;
  }[] = [];
  const cacheDecls: NodePath<t.VariableDeclarator>[] = [];
  const defineMessagesDecls: NodePath<t.VariableDeclarator>[] = [];
  const providerElements: NodePath<t.JSXElement>[] = [];

  traverse(ast, {
    VariableDeclarator(path) {
      const id = path.node.id;
      const init = unwrapAwait(path.node.init);
      if (!init || !t.isCallExpression(init) || !t.isIdentifier(init.callee)) {
        return;
      }
      const callee = init.callee.name;
      if (useIntlLocals.has(callee) && t.isIdentifier(id)) {
        intlBindings.set(id.name, 'client');
        intlBindingFns.set(id.name, enclosingFunction(path));
        useIntlDecls.push(path);
      } else if (createIntlLocals.has(callee) && t.isIdentifier(id)) {
        intlBindings.set(id.name, 'server');
        intlBindingFns.set(id.name, enclosingFunction(path));
        createIntlDecls.push({ declarator: path, fn: enclosingFunction(path) });
      } else if (createIntlCacheLocals.has(callee)) {
        cacheDecls.push(path);
      } else if (defineMessagesLocals.has(callee) && t.isIdentifier(id)) {
        const table = readDescriptorTable(init.arguments[0]);
        if (table) {
          descriptorTables.set(id.name, table);
          defineMessagesDecls.push(path);
        } else {
          skipReasons.push(
            `defineMessages('${id.name}') has non-literal descriptors (id must be a string literal) — convert manually`
          );
        }
      }
    },
    JSXElement(path) {
      const name = path.node.openingElement.name;
      if (t.isJSXIdentifier(name) && providerLocals.has(name.name)) {
        providerElements.push(path);
      }
    },
  });

  // Provider retained (partial migration): leave <IntlProvider> and its import
  // untouched; skipped files still need the react-intl context.
  const providerUnwraps = retainProvider ? [] : providerElements;

  // ---- planned conversions -------------------------------------------------

  const formatMessageCalls: {
    call: NodePath<t.CallExpression>;
    binding: string;
    id: string;
    values: t.Expression | null;
  }[] = [];
  const formattedMessages: {
    element: NodePath<t.JSXElement>;
    id: string;
    values: t.Expression | null;
    fn: t.Function | null;
  }[] = [];
  const richInline: PlannedRich[] = [];
  const formatterElements: {
    element: NodePath<t.JSXElement>;
    kind: string;
  }[] = [];
  let needsClientT = false;
  let needsServerT = false;
  const usedComponents = new Set<string>();

  traverse(ast, {
    CallExpression(path) {
      const callee = path.node.callee;
      if (
        !t.isMemberExpression(callee) ||
        callee.computed ||
        !t.isIdentifier(callee.object) ||
        !t.isIdentifier(callee.property)
      ) {
        return;
      }
      const objectName = callee.object.name;
      const kind = intlBindings.get(objectName);
      if (!kind) return;
      const method = callee.property.name;
      if (method !== 'formatMessage') {
        skipReasons.push(
          `${objectName}.${method}() has no bare gt-next hook — use the matching gt-next component in JSX, or convert manually`
        );
        return;
      }
      const [descriptorArg, valuesArg] = path.node.arguments;
      const id = resolveDescriptorId(descriptorArg, descriptorTables);
      if (id === null) {
        skipReasons.push(
          `${objectName}.formatMessage(...) uses a dynamic descriptor/id — it cannot map to a dictionary key (and unknown keys throw in gt-next); convert manually`
        );
        return;
      }
      const message = catalogMessage(id, ctx);
      if (message === null) {
        skipReasons.push(
          `${objectName}.formatMessage('${id}') has no source entry in the '${ctx.catalogs.defaultLocale}' catalog — gt-next's dictionary t() throws on unknown keys, so add '${id}' to it (or give the call a literal defaultMessage so a missing default-locale catalog can be synthesized) or convert manually`
        );
        return;
      }
      if (isRichOrHasFunctionValues(message, valuesArg)) {
        skipReasons.push(
          `${objectName}.formatMessage('${id}') has rich-text tags/chunk functions gt-next's dictionary t() cannot render (t returns a string) — re-run with --inline to convert to inline <T>, or convert manually`
        );
        return;
      }
      const values = valuesArg && t.isExpression(valuesArg) ? valuesArg : null;
      formatMessageCalls.push({ call: path, binding: objectName, id, values });
      if (kind === 'server') needsServerT = true;
    },
    JSXElement(path) {
      const name = path.node.openingElement.name;
      if (!t.isJSXIdentifier(name)) return;
      const elementName = name.name;

      if (formattedMessageLocals.has(elementName)) {
        planFormattedMessage(path, elementName);
        return;
      }
      const formatterKind = formatterLocals.get(elementName);
      if (formatterKind) {
        formatterElements.push({ element: path, kind: formatterKind });
        return;
      }
    },
  });

  function planFormattedMessage(
    path: NodePath<t.JSXElement>,
    _elementName: string
  ): void {
    const opening = path.node.openingElement;
    const idAttr = jsxAttr(opening, 'id');
    const id = idAttr ? stringAttrValue(idAttr) : null;
    if (id === null) {
      skipReasons.push(
        `<FormattedMessage> with a dynamic or missing id cannot map to a dictionary key — convert manually`
      );
      return;
    }
    // render-prop children have no gt-next equivalent.
    const renderProp = path.node.children.find(
      (child) =>
        t.isJSXExpressionContainer(child) &&
        (t.isArrowFunctionExpression(child.expression) ||
          t.isFunctionExpression(child.expression))
    );
    if (renderProp) {
      skipReasons.push(
        `<FormattedMessage>{(chunks) => …}</FormattedMessage> render-prop children have no gt-next equivalent — convert manually`
      );
      return;
    }
    const message = catalogMessage(id, ctx);
    if (message === null) {
      skipReasons.push(
        `<FormattedMessage id="${id}"> has no source entry in the '${ctx.catalogs.defaultLocale}' catalog — gt-next's dictionary t() throws on unknown keys, so add '${id}' to it (or give it a literal defaultMessage so a missing default-locale catalog can be synthesized) or convert manually`
      );
      return;
    }
    const valuesAttr = jsxAttr(opening, 'values');
    const valuesExpr =
      valuesAttr &&
      t.isJSXExpressionContainer(valuesAttr.value) &&
      t.isExpression(valuesAttr.value.expression)
        ? valuesAttr.value.expression
        : null;

    const rich = analyzeRich(message, valuesExpr);
    if (rich === 'rich') {
      if (!ctx.inlineMode) {
        skipReasons.push(
          `<FormattedMessage id="${id}"> has rich-text tags gt-next's dictionary t() cannot render — re-run with --inline to convert to inline <T>, or convert manually`
        );
        return;
      }
      const conversion = buildRichConversion(path, message, valuesExpr);
      if (typeof conversion === 'string') {
        skipReasons.push(conversion);
        return;
      }
      richInline.push(conversion);
      todos.push({
        file,
        line: path.node.loc?.start.line,
        reason:
          '<FormattedMessage> rich text converted to inline <T> — regenerate translations for this content (`npx gt translate`)',
      });
      return;
    }

    const fn = enclosingFunction(path);
    formattedMessages.push({ element: path, id, values: valuesExpr, fn });
  }

  const uniqueSkips = [...new Set(skipReasons)];
  if (uniqueSkips.length > 0) {
    return { code: null, todos: [], skipReasons: uniqueSkips, usedRich: false };
  }

  // Nothing react-intl-shaped to do (only type imports, etc.) and nothing to
  // unwrap: report the file unchanged so the driver leaves it be.
  const hasWork =
    formatMessageCalls.length > 0 ||
    formattedMessages.length > 0 ||
    richInline.length > 0 ||
    formatterElements.length > 0 ||
    createIntlDecls.length > 0 ||
    cacheDecls.length > 0 ||
    defineMessagesDecls.length > 0 ||
    providerUnwraps.length > 0 ||
    (!retainProvider && reactIntlImports.length > 0);

  // ---- mutation ------------------------------------------------------------

  // 1. createIntl(...) -> await getTranslations(); make the enclosing function
  //    async when it is safe (the awaited component or an already-async fn).
  for (const { declarator, fn } of createIntlDecls) {
    const componentFn = findDefaultExportFunction(ast);
    if (!fn || (!fn.async && fn !== componentFn)) {
      return {
        code: null,
        todos: [],
        skipReasons: [
          'createIntl(...) is not inside an async Server Component — convert it to `await getTranslations()` inside an async component manually',
        ],
        usedRich: false,
      };
    }
    if (!fn.async) fn.async = true;
    declarator.node.init = t.awaitExpression(
      t.callExpression(t.identifier('getTranslations'), [])
    );
    needsServerT = true;
  }
  // Drop `const cache = createIntlCache()` (gt-next has no cache handle).
  for (const cache of cacheDecls) {
    const declaration = cache.parentPath;
    if (
      declaration.isVariableDeclaration() &&
      declaration.node.declarations.length === 1
    ) {
      declaration.remove();
    } else {
      cache.remove();
    }
  }

  // 2. client `const intl = useIntl()` -> `const intl = useTranslations()`.
  //    react-intl's useIntl takes no argument; gt-next's useTranslations resolves
  //    the full id, so no namespace/rootId is threaded through.
  for (const decl of useIntlDecls) {
    decl.node.init = t.callExpression(t.identifier('useTranslations'), []);
    needsClientT = true;
  }

  // 3. intl.formatMessage({ id }, values) -> intl(id, values).
  for (const { call, binding, id, values } of formatMessageCalls) {
    const args: t.Expression[] = [t.stringLiteral(id)];
    if (values) args.push(values);
    call.replaceWith(t.callExpression(t.identifier(binding), args));
  }

  // 4. <FormattedMessage id values /> -> {t(id, values)} (reuse an in-scope
  //    intl binding, else inject `const $gtT = useTranslations()`).
  const injectedByFn = new Map<t.Function, string>();
  for (const { element, id, values, fn } of formattedMessages) {
    const bindingName = translationBindingFor(
      fn,
      intlBindings,
      intlBindingFns,
      injectedByFn
    );
    if (bindingName.injected) needsClientT = true;
    const args: t.Expression[] = [t.stringLiteral(id)];
    if (values) args.push(values);
    element.replaceWith(
      t.jsxExpressionContainer(
        t.callExpression(t.identifier(bindingName.name), args)
      )
    );
  }
  // Insert the injected `const $gtT = useTranslations()` at the top of each
  // function that needed one.
  for (const [fn, name] of injectedByFn) {
    insertHookDeclaration(fn, name);
  }

  // 5. value formatters -> gt-next components.
  for (const { element, kind } of formatterElements) {
    const result = convertFormatter(element, kind, todos, file);
    if ('skip' in result) {
      // A late, element-local skip (spread props, unmappable prop). The
      // whole-file skip contract still holds: nothing has been written to ctx.
      return {
        code: null,
        todos: [],
        skipReasons: [result.skip],
        usedRich: false,
      };
    }
    usedComponents.add(result.component);
  }

  // 6. rich inline <T> conversions (--inline only).
  for (const conversion of richInline) {
    const children = icuToJsxChildren(conversion.elements, conversion.chunkMap);
    const tElement = t.jsxElement(
      t.jsxOpeningElement(t.jsxIdentifier('T'), []),
      t.jsxClosingElement(t.jsxIdentifier('T')),
      children
    );
    conversion.container.replaceWith(tElement);
    usedComponents.add('T');
  }

  // 7. defineMessages tables become dead once their ids are inlined.
  for (const decl of defineMessagesDecls) {
    const declaration = decl.parentPath;
    if (
      declaration.isVariableDeclaration() &&
      declaration.node.declarations.length === 1
    ) {
      declaration.remove();
    } else {
      decl.remove();
    }
  }

  // 8. provider unwrap: <IntlProvider ...>children</IntlProvider> -> <>children</>
  //    (the layout pass inserts the server GTProvider).
  for (const providerPath of providerUnwraps) {
    const children = providerPath.node.children;
    providerPath.replaceWith(
      t.jsxFragment(t.jsxOpeningFragment(), t.jsxClosingFragment(), children)
    );
  }

  if (!hasWork) {
    return none;
  }

  // 9. import surgery.
  for (const importPath of reactIntlImports) {
    if (importPath.node.source.value.startsWith('@formatjs/')) {
      importPath.remove();
      continue;
    }
    const kept = importPath.node.specifiers.filter(
      (specifier): specifier is t.ImportSpecifier =>
        retainProvider &&
        t.isImportSpecifier(specifier) &&
        t.isIdentifier(specifier.imported) &&
        specifier.imported.name === 'IntlProvider'
    );
    if (kept.length > 0) {
      importPath.node.specifiers = kept;
    } else {
      importPath.remove();
    }
  }

  const clientImports: string[] = [];
  if (needsClientT) clientImports.push('useTranslations');
  for (const component of ['Num', 'DateTime', 'Plural', 'RelativeTime', 'T']) {
    if (usedComponents.has(component)) clientImports.push(component);
  }
  if (clientImports.length > 0)
    ensureNamedImports(ast, GT_MODULE, clientImports);
  if (needsServerT) {
    ensureNamedImports(ast, GT_SERVER_MODULE, ['getTranslations']);
  }

  const output = generate(
    ast,
    {
      retainLines: true,
      retainFunctionParens: true,
      comments: true,
      compact: 'auto',
    },
    code
  );
  return {
    code: output.code,
    todos,
    skipReasons: [],
    usedRich: richInline.length > 0,
  };
}

// ---- helpers ---------------------------------------------------------------

function reasonForUnsupported(imported: string, source: string): string {
  switch (imported) {
    case 'injectIntl':
      return 'injectIntl (class-component HOC) has no gt-next equivalent — convert the class to a function component using useTranslations, or keep it on react-intl';
    case 'RawIntlProvider':
      return 'RawIntlProvider has no gt-next equivalent — gt-next resolves its provider context server-side; wrap your [locale] layout in <GTProvider> instead';
    case 'FormattedList':
    case 'FormattedListParts':
      return 'FormattedList/formatList has no gt-next component in v1 (gt.formatList exists only on the core runtime) — convert manually';
    case 'FormattedDisplayName':
      return 'FormattedDisplayName/formatDisplayName has no gt-next component in v1 — use getLocaleProperties or convert manually';
    case 'FormattedNumberParts':
    case 'FormattedDateParts':
    case 'FormattedTimeParts':
      return `${imported} (…ToParts) has no gt-next equivalent — convert manually`;
    default:
      return `unsupported react-intl API: ${imported} (from '${source}')`;
  }
}

/** Reads a `defineMessages({ key: { id: '…' } })` object into a key -> id map,
 *  or null when any descriptor is not a plain literal. */
function readDescriptorTable(
  node: t.Node | undefined
): Map<string, string> | null {
  if (!node || !t.isObjectExpression(node)) return null;
  const table = new Map<string, string>();
  for (const property of node.properties) {
    if (
      !t.isObjectProperty(property) ||
      property.computed ||
      !t.isIdentifier(property.key) ||
      !t.isObjectExpression(property.value)
    ) {
      return null;
    }
    const id = getObjectProp(property.value, 'id');
    if (!id || !t.isStringLiteral(id)) return null;
    table.set(property.key.name, id.value);
  }
  return table;
}

/** Resolves a formatMessage descriptor to a literal id: an inline object
 *  `{ id: '…' }`, a `M.key` reference into a defineMessages table, or a
 *  `defineMessage({ id })` call. Returns null for anything dynamic. */
function resolveDescriptorId(
  node: t.Node | undefined,
  tables: Map<string, Map<string, string>>
): string | null {
  if (!node) return null;
  if (t.isObjectExpression(node)) {
    const id = getObjectProp(node, 'id');
    return id && t.isStringLiteral(id) ? id.value : null;
  }
  if (
    t.isMemberExpression(node) &&
    !node.computed &&
    t.isIdentifier(node.object) &&
    t.isIdentifier(node.property)
  ) {
    return tables.get(node.object.name)?.get(node.property.name) ?? null;
  }
  if (
    t.isCallExpression(node) &&
    t.isIdentifier(node.callee, { name: 'defineMessage' })
  ) {
    const arg = node.arguments[0];
    if (t.isObjectExpression(arg)) {
      const id = getObjectProp(arg, 'id');
      return id && t.isStringLiteral(id) ? id.value : null;
    }
  }
  return null;
}

/** The source message for an id from the default-locale catalog, or null when
 *  absent (in case b2 this catalog already holds the harvested defaultMessages,
 *  so a null result means the id has no source anywhere). */
function catalogMessage(id: string, ctx: MigrationContext): string | null {
  const catalog = ctx.catalogs.byLocale[ctx.catalogs.defaultLocale] ?? {};
  const value = (catalog as Record<string, unknown>)[id];
  return typeof value === 'string' ? value : null;
}

/** True when a formatMessage message contains rich-text tags or its values
 *  include a chunk function — either way the dictionary t() (string result)
 *  cannot render it. */
function isRichOrHasFunctionValues(
  message: string | null,
  valuesArg: t.Node | undefined
): boolean {
  if (message !== null && classifyMessage(message).kind === 'tags') return true;
  if (valuesArg && t.isObjectExpression(valuesArg)) {
    return valuesArg.properties.some(
      (property) =>
        t.isObjectProperty(property) &&
        (t.isArrowFunctionExpression(property.value) ||
          t.isFunctionExpression(property.value))
    );
  }
  return false;
}

/** 'rich' when the message has tags (needs component rendering), 'plain'
 *  otherwise. Unknown messages are treated as plain (dictionary path). */
function analyzeRich(
  message: string | null,
  valuesExpr: t.Expression | null
): 'rich' | 'plain' {
  if (message !== null && classifyMessage(message).kind === 'tags') {
    return 'rich';
  }
  if (valuesExpr && t.isObjectExpression(valuesExpr)) {
    const hasFn = valuesExpr.properties.some(
      (property) =>
        t.isObjectProperty(property) &&
        (t.isArrowFunctionExpression(property.value) ||
          t.isFunctionExpression(property.value))
    );
    if (hasFn) return 'rich';
  }
  return 'plain';
}

/** Builds a trivial-chunk rich conversion for a <FormattedMessage> (mirrors
 *  #1910's t.rich handling), or a skip reason string. */
function buildRichConversion(
  element: NodePath<t.JSXElement>,
  message: string | null,
  valuesExpr: t.Expression | null
): PlannedRich | string {
  const manual =
    '<FormattedMessage> rich text needs manual conversion (non-trivial tag wrappers or missing catalog entry)';
  if (message === null) return manual;
  const chunkMap = new Map<string, t.JSXElement>();
  if (valuesExpr) {
    if (!t.isObjectExpression(valuesExpr)) return manual;
    for (const property of valuesExpr.properties) {
      if (
        !t.isObjectProperty(property) ||
        property.computed ||
        !t.isIdentifier(property.key)
      ) {
        return manual;
      }
      // Non-function values (plain args) are fine to ignore here; only chunk
      // wrappers become tag templates.
      if (
        t.isArrowFunctionExpression(property.value) ||
        t.isFunctionExpression(property.value)
      ) {
        const chunk = trivialChunkElement(property.value);
        if (!chunk) return manual;
        chunkMap.set(property.key.name, chunk);
      }
    }
  }
  let elements: MessageFormatElement[];
  try {
    elements = parseIcu(message);
  } catch {
    return manual;
  }
  if (!allTagsMapped(elements, chunkMap)) return manual;
  return { container: element, elements, chunkMap };
}

/** The outcome of a value-formatter conversion: the gt-next component name it
 *  became, or a reason the whole file must be skipped. Discriminated so a
 *  successful component name is never mistaken for a skip reason. */
type FormatterOutcome = { component: string } | { skip: string };

/** Converts a value-formatter element in place. */
function convertFormatter(
  element: NodePath<t.JSXElement>,
  kind: string,
  todos: TodoEntry[],
  file: string
): FormatterOutcome {
  const opening = element.node.openingElement;
  if (opening.attributes.some((attr) => t.isJSXSpreadAttribute(attr))) {
    return {
      skip: `<${kind}> uses spread props that cannot be mapped to gt-next options — convert manually`,
    };
  }

  if (kind === 'FormattedPlural') {
    const value = jsxAttr(opening, 'value');
    if (!value || !t.isJSXExpressionContainer(value.value)) {
      return {
        skip: '<FormattedPlural> needs a `value={…}` expression — convert manually',
      };
    }
    const kept: t.JSXAttribute[] = [];
    for (const attr of opening.attributes) {
      if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name)) continue;
      const name = attr.name.name;
      if (name === 'value') {
        kept.push(t.jsxAttribute(t.jsxIdentifier('n'), value.value));
      } else if (PLURAL_CATEGORIES.has(name)) {
        kept.push(attr);
      } else {
        todos.push({
          file,
          line: opening.loc?.start.line,
          reason: `<Plural>: dropped <FormattedPlural> prop \`${name}\` (no gt-next equivalent) — verify output`,
        });
      }
    }
    renameElement(element, 'Plural', kept);
    return { component: 'Plural' };
  }

  if (kind === 'FormattedRelativeTime') {
    const kept: t.JSXAttribute[] = [];
    const options: t.ObjectProperty[] = [];
    for (const attr of opening.attributes) {
      if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name)) continue;
      const name = attr.name.name;
      if (name === 'value' || name === 'unit') {
        kept.push(attr);
      } else if (name === 'updateIntervalInSeconds') {
        todos.push({
          file,
          line: opening.loc?.start.line,
          reason:
            '<RelativeTime>: react-intl auto-updated (updateIntervalInSeconds); gt-next renders a static value — add your own timer if a live tick is required',
        });
      } else {
        const prop = attrToObjectProp(attr);
        if (prop) options.push(prop);
      }
    }
    if (options.length > 0) {
      kept.push(
        t.jsxAttribute(
          t.jsxIdentifier('options'),
          t.jsxExpressionContainer(t.objectExpression(options))
        )
      );
    }
    renameElement(element, 'RelativeTime', kept);
    return { component: 'RelativeTime' };
  }

  const formatter = CHILD_VALUE_FORMATTERS[kind];
  const value = jsxAttr(opening, 'value');
  if (!value || !t.isJSXExpressionContainer(value.value)) {
    return {
      skip: `<${kind}> needs a \`value={…}\` expression — convert manually`,
    };
  }
  const valueExpr = value.value.expression;
  if (!t.isExpression(valueExpr)) {
    return {
      skip: `<${kind}> has an unsupported \`value\` — convert manually`,
    };
  }
  const options: t.ObjectProperty[] = [];
  for (const [name, literal] of Object.entries(
    formatter.defaultOptions ?? {}
  )) {
    options.push(
      t.objectProperty(t.identifier(name), t.stringLiteral(literal))
    );
  }
  for (const attr of opening.attributes) {
    if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name)) continue;
    if (attr.name.name === 'value') continue;
    const prop = attrToObjectProp(attr);
    if (!prop) {
      return {
        skip: `<${kind}> prop \`${attr.name.name}\` cannot be mapped to gt-next options — convert manually`,
      };
    }
    // Later (explicit) props override the defaults.
    const existing = options.findIndex(
      (option) =>
        t.isIdentifier(option.key) &&
        t.isIdentifier(prop.key) &&
        option.key.name === prop.key.name
    );
    if (existing >= 0) options[existing] = prop;
    else options.push(prop);
  }
  const attributes: t.JSXAttribute[] =
    options.length > 0
      ? [
          t.jsxAttribute(
            t.jsxIdentifier('options'),
            t.jsxExpressionContainer(t.objectExpression(options))
          ),
        ]
      : [];
  const target = formatter.target;
  const replacement = t.jsxElement(
    t.jsxOpeningElement(t.jsxIdentifier(target), attributes, false),
    t.jsxClosingElement(t.jsxIdentifier(target)),
    [t.jsxExpressionContainer(valueExpr)]
  );
  element.replaceWith(replacement);
  return { component: target };
}

function renameElement(
  element: NodePath<t.JSXElement>,
  target: string,
  attributes: t.JSXAttribute[]
): void {
  const opening = element.node.openingElement;
  opening.name = t.jsxIdentifier(target);
  opening.attributes = attributes;
  if (element.node.closingElement) {
    element.node.closingElement.name = t.jsxIdentifier(target);
  }
}

/** Turns a JSX attribute into an object property for a gt-next `options` bag,
 *  or null when its value cannot be represented. */
function attrToObjectProp(attr: t.JSXAttribute): t.ObjectProperty | null {
  if (!t.isJSXIdentifier(attr.name)) return null;
  const key = t.identifier(attr.name.name);
  const value = attr.value;
  if (value === null || value === undefined) {
    return t.objectProperty(key, t.booleanLiteral(true));
  }
  if (t.isStringLiteral(value)) {
    return t.objectProperty(key, t.stringLiteral(value.value));
  }
  if (t.isJSXExpressionContainer(value) && t.isExpression(value.expression)) {
    return t.objectProperty(key, value.expression);
  }
  return null;
}

function jsxAttr(
  opening: t.JSXOpeningElement,
  name: string
): t.JSXAttribute | null {
  for (const attr of opening.attributes) {
    if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name, { name })) {
      return attr;
    }
  }
  return null;
}

/** A JSX attribute's value as a string when it is `x="lit"` or `x={'lit'}`. */
function stringAttrValue(attr: t.JSXAttribute): string | null {
  const value = attr.value;
  if (t.isStringLiteral(value)) return value.value;
  if (
    t.isJSXExpressionContainer(value) &&
    t.isStringLiteral(value.expression)
  ) {
    return value.expression.value;
  }
  return null;
}

function getObjectProp(
  object: t.ObjectExpression,
  name: string
): t.Expression | null {
  for (const property of object.properties) {
    if (
      t.isObjectProperty(property) &&
      !property.computed &&
      t.isIdentifier(property.key, { name }) &&
      t.isExpression(property.value)
    ) {
      return property.value;
    }
  }
  return null;
}

function unwrapAwait(node: t.Node | null | undefined): t.Expression | null {
  if (!node) return null;
  let current: t.Node = node;
  for (;;) {
    if (t.isAwaitExpression(current)) current = current.argument;
    else if (t.isParenthesizedExpression(current)) current = current.expression;
    else break;
  }
  return t.isExpression(current) ? current : null;
}

function unwrapParens(node: t.Node): t.Node {
  let current = node;
  while (t.isParenthesizedExpression(current)) current = current.expression;
  return current;
}

function enclosingFunction(path: NodePath): t.Function | null {
  const fn = path.getFunctionParent();
  return fn ? fn.node : null;
}

/**
 * The translation-function binding a <FormattedMessage> should call: an in-scope
 * client intl binding (from useIntl, now useTranslations), else an injected
 * `const $gtT = useTranslations()` in its enclosing function.
 */
function translationBindingFor(
  fn: t.Function | null,
  intlBindings: Map<string, 'client' | 'server'>,
  intlBindingFns: Map<string, t.Function | null>,
  injectedByFn: Map<t.Function, string>
): { name: string; injected: boolean } {
  for (const [name, kind] of intlBindings) {
    if (kind !== 'client') continue;
    const bindingFn = intlBindingFns.get(name) ?? null;
    if (bindingFn === null || bindingFn === fn) {
      return { name, injected: false };
    }
  }
  if (fn) {
    const existing = injectedByFn.get(fn);
    if (existing) return { name: existing, injected: true };
    injectedByFn.set(fn, '$gtT');
    return { name: '$gtT', injected: true };
  }
  // No enclosing function (module scope): fall back to a shared name; the
  // caller adds the import. Extremely rare for a real component.
  return { name: '$gtT', injected: true };
}

/** Inserts `const <name> = useTranslations();` at the top of a function body. */
function insertHookDeclaration(fn: t.Function, name: string): void {
  if (!t.isBlockStatement(fn.body)) return;
  const declaration = t.variableDeclaration('const', [
    t.variableDeclarator(
      t.identifier(name),
      t.callExpression(t.identifier('useTranslations'), [])
    ),
  ]);
  fn.body.body.unshift(declaration);
}

function findDefaultExportFunction(ast: t.File): t.Function | null {
  let result: t.Function | null = null;
  traverse(ast, {
    ExportDefaultDeclaration(path) {
      const declaration = path.node.declaration;
      if (
        t.isFunctionDeclaration(declaration) ||
        t.isArrowFunctionExpression(declaration) ||
        t.isFunctionExpression(declaration)
      ) {
        result = declaration;
        return;
      }
      if (!t.isIdentifier(declaration)) return;
      const binding = path.scope.getBinding(declaration.name);
      if (!binding) return;
      const node = binding.path.node;
      if (t.isFunctionDeclaration(node)) {
        result = node;
      } else if (
        t.isVariableDeclarator(node) &&
        (t.isArrowFunctionExpression(node.init) ||
          t.isFunctionExpression(node.init))
      ) {
        result = node.init;
      }
    },
  });
  return result;
}

// ---- rich-text helpers (mirrors transformSource.ts's t.rich machinery) -----

function trivialChunkElement(node: t.Node): t.JSXElement | null {
  const fn = unwrapParens(node);
  if (!t.isArrowFunctionExpression(fn) || fn.params.length !== 1) return null;
  const param = fn.params[0];
  if (!t.isIdentifier(param)) return null;
  const body = unwrapParens(fn.body);
  if (!t.isJSXElement(body)) return null;
  const children = body.children.filter(
    (child) => !(t.isJSXText(child) && child.value.trim() === '')
  );
  if (children.length !== 1) return null;
  const child = children[0];
  if (
    !t.isJSXExpressionContainer(child) ||
    !t.isIdentifier(child.expression, { name: param.name })
  ) {
    return null;
  }
  return body;
}

function allTagsMapped(
  elements: MessageFormatElement[],
  chunkMap: Map<string, t.JSXElement>
): boolean {
  for (const element of elements) {
    if (isTagElement(element)) {
      if (!chunkMap.has(element.value)) return false;
      if (!allTagsMapped(element.children, chunkMap)) return false;
    }
  }
  return true;
}

function icuToJsxChildren(
  elements: MessageFormatElement[],
  chunkMap: Map<string, t.JSXElement>
): (t.JSXText | t.JSXExpressionContainer | t.JSXElement)[] {
  const children: (t.JSXText | t.JSXExpressionContainer | t.JSXElement)[] = [];
  for (const element of elements) {
    if (isTagElement(element)) {
      const template = chunkMap.get(element.value)!;
      const clone = t.cloneNode(template, true);
      clone.children = icuToJsxChildren(element.children, chunkMap);
      children.push(clone);
    } else if ('value' in element && typeof element.value === 'string') {
      const text = element.value;
      if (/[{}<>]/.test(text)) {
        children.push(t.jsxExpressionContainer(t.stringLiteral(text)));
      } else {
        children.push(t.jsxText(text));
      }
    }
  }
  return children;
}
