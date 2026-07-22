import { parse } from '@babel/parser';
import traverseModule, { type NodePath } from '@babel/traverse';
import generateModule from '@babel/generator';
import * as t from '@babel/types';
import { classifyMessage } from '../catalogs/classifyMessage.js';
import { ensureNamedImports } from '../transforms/importUtils.js';
import type { TransformOptions } from '../transforms/transformSource.js';
import {
  isParamsInit,
  removeParamsParameter,
} from '../transforms/transformSource.js';
import type {
  MigrationContext,
  SourceResult,
  TodoEntry,
} from '../pipeline/types.js';

const traverse: typeof traverseModule =
  (traverseModule as { default?: typeof traverseModule }).default ||
  traverseModule;
const generate: typeof generateModule =
  (generateModule as { default?: typeof generateModule }).default ||
  generateModule;

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

/**
 * react-intl -> gt-next per-file transform. Dictionary-compat by default:
 * `intl.formatMessage({ id }, values)` -> `t(id, values)`, `<FormattedMessage
 * id />` -> `{t(id, values)}`, value formatters -> gt-next components, catalogs
 * reused verbatim. Rich-text tags skip with a reason (the opt-in inline <T>
 * conversion ships as a follow-up PR);
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

  const retainProvider = options.retainProvider === true;
  const skipReasons: string[] = [];
  const todos: TodoEntry[] = [];

  // Ids flagged during catalog discovery as colliding: present both as a leaf
  // value and as a namespace prefix (e.g. 'a' and 'a.b'), which gt-next's nested
  // dictionary cannot represent. Built once here where the catalogs are in
  // scope; the plan* helpers close over it for an O(1) membership test per
  // formatMessage / <FormattedMessage> site instead of scanning the array.
  const collidingIds = new Set(ctx.catalogs.flatKeyCollisions ?? []);

  // ---- imports -------------------------------------------------------------

  type ImportedSymbol = {
    imported: string;
    local: string;
    specifier: t.ImportSpecifier;
  };
  const symbols: ImportedSymbol[] = [];
  const reactIntlImports: NodePath<t.ImportDeclaration>[] = [];
  // A re-export from react-intl (`export { X } from 'react-intl'`, `export *
  // from '@formatjs/*'`) is neither an import to convert nor a usage to rewrite,
  // but it dangles once react-intl is uninstalled. Mirror the next-intl engine's
  // noteReexport: skip+report so teardown never leaves a broken re-export.
  let hasReactIntlReexport = false;
  const noteReexport = (source: string | null | undefined) => {
    if (!source || (source !== MODULE && !source.startsWith('@formatjs/'))) {
      return;
    }
    hasReactIntlReexport = true;
    skipReasons.push(
      `re-export from '${source}' would break once react-intl is removed; convert the re-export manually`
    );
  };
  traverse(ast, {
    ExportNamedDeclaration(path) {
      if (path.node.source) noteReexport(path.node.source.value);
    },
    ExportAllDeclaration(path) {
      noteReexport(path.node.source.value);
    },
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
            `unsupported react-intl API: ${imported} (from '${source}'); advanced @formatjs usage has no v1 gt-next mapping`
          );
        } else if (!SUPPORTED_IMPORTS.has(imported)) {
          skipReasons.push(reasonForUnsupported(imported, source));
        }
      }
    },
  });
  if (reactIntlImports.length === 0 && !hasReactIntlReexport) return none;

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
  // Scope-aware matching: the exact binding identifier node -> kind. A name
  // match alone corrupts an unrelated `intl` prop/param in another scope (a
  // react-intl IntlShape), so `X.formatMessage` calls resolve through
  // path.scope.getBinding and are rewritten only when the binding is one of
  // these captured useIntl/createIntl declarators.
  const intlBindingIdNodes = new Map<t.Node, 'client' | 'server'>();
  // Destructured `const { formatMessage } = useIntl()` locals (binding id node),
  // rewritten to `const <local> = useTranslations()` with bare `<local>(id)`
  // calls.
  const formatMessageBindingIdNodes = new Set<t.Node>();
  const useIntlDestructureDecls: {
    path: NodePath<t.VariableDeclarator>;
    localName: string;
  }[] = [];
  // Set when a descriptor/element carries a defaultMessage but no literal id
  // (the FormatJS auto-generated-id workflow); surfaces one top-level warning.
  let autoIdSeen = false;
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
      if (useIntlLocals.has(callee)) {
        if (t.isIdentifier(id)) {
          intlBindings.set(id.name, 'client');
          intlBindingFns.set(id.name, enclosingFunction(path));
          intlBindingIdNodes.set(id, 'client');
          useIntlDecls.push(path);
        } else if (t.isObjectPattern(id)) {
          planUseIntlDestructure(path, id);
        } else {
          skipReasons.push(
            'const … = useIntl() uses an unsupported binding form (array/other pattern); convert manually'
          );
        }
      } else if (createIntlLocals.has(callee) && t.isIdentifier(id)) {
        intlBindings.set(id.name, 'server');
        intlBindingFns.set(id.name, enclosingFunction(path));
        intlBindingIdNodes.set(id, 'server');
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
            `defineMessages('${id.name}') has non-literal descriptors (id must be a string literal); convert manually`
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

  // A client intl binding (useIntl-derived) declared at module scope is invalid
  // react-intl: hooks run only inside components. Rewriting it to a module-scope
  // useTranslations(); and reusing it inside components; would carry that
  // rules-of-hooks violation straight into the output, so skip+report instead of
  // silently propagating it (a null enclosing function means module scope; every
  // client binding records its enclosing function, so this never false-fires on
  // an in-component binding).
  for (const [name, kind] of intlBindings) {
    if (kind === 'client' && (intlBindingFns.get(name) ?? null) === null) {
      skipReasons.push(
        `useIntl() is called at module scope (bound to '${name}'), which violates React's rules of hooks; move it inside the component, then re-run gt migrate`
      );
    }
  }

  // Provider retained (partial migration): leave <IntlProvider> and its import
  // untouched; skipped files still need the react-intl context.
  const providerUnwraps = retainProvider ? [] : providerElements;

  // Unwrapping a provider drops every attribute. locale/defaultLocale/messages
  // are subsumed by gt-next's GTProvider, but timeZone/onError/textComponent/
  // formats/defaultRichTextElements (or any spread) are load-bearing config with
  // no equivalent; silently dropping them changes behavior. Skip+report the
  // whole file so they migrate by hand (the unsupported-API contract in this
  // adapter's doc comment).
  for (const providerPath of providerUnwraps) {
    skipReasons.push(...providerDropReasons(providerPath.node.openingElement));
  }

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
      // member: `X.formatMessage(...)` where X is a captured useIntl/createIntl
      // binding, resolved through scope so an unrelated `intl` prop/param in
      // another scope is never rewritten (which would corrupt it).
      if (
        t.isMemberExpression(callee) &&
        !callee.computed &&
        t.isIdentifier(callee.object) &&
        t.isIdentifier(callee.property)
      ) {
        const objectName = callee.object.name;
        if (!intlBindings.has(objectName)) return;
        const binding = path.scope.getBinding(objectName);
        if (!binding) return;
        const kind = intlBindingIdNodes.get(binding.identifier);
        if (!kind) return; // a shadow, a prop, or an unrelated same-named object
        const method = callee.property.name;
        if (method !== 'formatMessage') {
          skipReasons.push(
            `${objectName}.${method}() has no bare gt-next hook; use the matching gt-next component in JSX, or convert manually`
          );
          return;
        }
        planFormatMessageCall(
          path,
          objectName,
          path.node.arguments[0],
          path.node.arguments[1],
          kind
        );
        return;
      }
      // bare: `formatMessage(...)` from a destructured `const { formatMessage }
      // = useIntl()` (rewritten below to `const <local> = useTranslations()`).
      if (t.isIdentifier(callee)) {
        const binding = path.scope.getBinding(callee.name);
        if (!binding || !formatMessageBindingIdNodes.has(binding.identifier)) {
          return;
        }
        planFormatMessageCall(
          path,
          callee.name,
          path.node.arguments[0],
          path.node.arguments[1],
          'client'
        );
      }
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

  /**
   * Handles `const { formatMessage } = useIntl()` (optionally aliased). The sole
   * supported destructured member is `formatMessage`; anything else has no bare
   * gt-next hook and skips the file. Registers the local so its bare calls are
   * rewritten and any sibling <FormattedMessage> reuses it.
   */
  function planUseIntlDestructure(
    path: NodePath<t.VariableDeclarator>,
    pattern: t.ObjectPattern
  ): void {
    let formatMessageLocal: t.Identifier | null = null;
    let ok = true;
    for (const property of pattern.properties) {
      if (
        !t.isObjectProperty(property) ||
        property.computed ||
        !t.isIdentifier(property.key) ||
        !t.isIdentifier(property.value)
      ) {
        skipReasons.push(
          'const { … } = useIntl() uses an unsupported destructuring form (rest/default/computed member); convert manually'
        );
        ok = false;
        continue;
      }
      if (property.key.name === 'formatMessage') {
        formatMessageLocal = property.value;
      } else {
        skipReasons.push(
          `const { ${property.key.name} } = useIntl() destructures '${property.key.name}', which has no bare gt-next hook; use the matching gt-next component/hook or convert manually`
        );
        ok = false;
      }
    }
    if (!ok || !formatMessageLocal) return;
    formatMessageBindingIdNodes.add(formatMessageLocal);
    useIntlDestructureDecls.push({ path, localName: formatMessageLocal.name });
    // The local becomes `useTranslations()`, so a sibling <FormattedMessage> can
    // reuse it as its translation function.
    intlBindings.set(formatMessageLocal.name, 'client');
    intlBindingFns.set(formatMessageLocal.name, enclosingFunction(path));
  }

  /**
   * Plans one formatMessage call (member or bare) into `formatMessageCalls`, or
   * pushes a skip reason (dynamic/auto-generated id, missing source entry,
   * flat/nested key collision, or rich content the dictionary t() cannot render).
   */
  function planFormatMessageCall(
    path: NodePath<t.CallExpression>,
    binding: string,
    descriptorArg: t.Node | undefined,
    valuesArg: t.Node | undefined,
    kind: 'client' | 'server'
  ): void {
    const id = resolveDescriptorId(descriptorArg, descriptorTables);
    if (id === null) {
      if (isAutoIdDescriptor(descriptorArg)) {
        autoIdSeen = true;
        skipReasons.push(
          `${binding}.formatMessage(...) has no literal id: FormatJS auto-generates ids at build time (overrideIdFn/idInterpolationPattern); gt-next needs a literal id; add an explicit id or convert manually`
        );
      } else {
        skipReasons.push(
          `${binding}.formatMessage(...) uses a dynamic descriptor/id; it cannot map to a dictionary key (and unknown keys throw in gt-next); convert manually`
        );
      }
      return;
    }
    if (collidingIds.has(id)) {
      skipReasons.push(collisionSkipReason(id));
      return;
    }
    const message = catalogMessage(id, ctx);
    if (message === null) {
      skipReasons.push(
        `${binding}.formatMessage('${id}') has no source entry in the '${ctx.catalogs.defaultLocale}' catalog; gt-next's dictionary t() throws on unknown keys, so add '${id}' to it (or give the call a literal defaultMessage so a missing default-locale catalog can be synthesized) or convert manually`
      );
      return;
    }
    if (isRichOrHasFunctionValues(message, valuesArg)) {
      skipReasons.push(
        `${binding}.formatMessage('${id}') has rich-text tags/chunk functions/element values gt-next's dictionary t() cannot render (t returns a string); convert manually`
      );
      return;
    }
    const values = valuesArg && t.isExpression(valuesArg) ? valuesArg : null;
    formatMessageCalls.push({ call: path, binding, id, values });
    if (kind === 'server') needsServerT = true;
  }

  function planFormattedMessage(
    path: NodePath<t.JSXElement>,
    _elementName: string
  ): void {
    const opening = path.node.openingElement;
    const idAttr = jsxAttr(opening, 'id');
    const id = idAttr ? stringAttrValue(idAttr) : null;
    if (id === null) {
      const dmAttr = jsxAttr(opening, 'defaultMessage');
      if (dmAttr && stringAttrValue(dmAttr) !== null) {
        autoIdSeen = true;
        skipReasons.push(
          '<FormattedMessage> has no literal id: FormatJS auto-generates ids at build time (overrideIdFn/idInterpolationPattern); gt-next needs a literal id; add an explicit id or convert manually'
        );
      } else {
        skipReasons.push(
          '<FormattedMessage> with a dynamic or missing id cannot map to a dictionary key; convert manually'
        );
      }
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
        `<FormattedMessage>{(chunks) => …}</FormattedMessage> render-prop children have no gt-next equivalent; convert manually`
      );
      return;
    }
    if (collidingIds.has(id)) {
      skipReasons.push(collisionSkipReason(id));
      return;
    }
    const message = catalogMessage(id, ctx);
    if (message === null) {
      skipReasons.push(
        `<FormattedMessage id="${id}"> has no source entry in the '${ctx.catalogs.defaultLocale}' catalog; gt-next's dictionary t() throws on unknown keys, so add '${id}' to it (or give it a literal defaultMessage so a missing default-locale catalog can be synthesized) or convert manually`
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
    if (rich !== 'plain') {
      // Rich content would need an inline <T> conversion, which embeds source
      // text and orphans existing translations; that opt-in pass ships as a
      // follow-up PR, so skip with the reason for now.
      const trigger =
        rich === 'tags'
          ? 'has rich-text tags'
          : 'has a JSX-element or chunk-function `values` entry';
      skipReasons.push(
        `<FormattedMessage id="${id}"> ${trigger} gt-next's dictionary t() cannot render; convert manually`
      );
      return;
    }

    // The hook must be owned by the enclosing component, not a callback the
    // component passes to a helper (e.g. items.map(item => <FormattedMessage/>)).
    // Injecting useTranslations() into the callback is a rules-of-hooks
    // violation; hookOwnerFunction climbs past callbacks to the component and the
    // callback closes over the binding. null = no legal owner -> whole-file skip.
    const fn = hookOwnerFunction(path);
    formattedMessages.push({ element: path, id, values: valuesExpr, fn });
  }

  // One top-level warning for the FormatJS auto-generated-id workflow, naming
  // the real cause (build-time hashed ids) instead of the misleading per-site
  // "dynamic id" noise. Deduped in the report.
  if (autoIdSeen) {
    (ctx.warnings ??= []).push(AUTO_ID_WARNING);
  }

  const uniqueSkips = [...new Set(skipReasons)];
  if (uniqueSkips.length > 0) {
    return { code: null, todos: [], skipReasons: uniqueSkips };
  }

  // Nothing react-intl-shaped to do (only type imports, etc.) and nothing to
  // unwrap: report the file unchanged so the driver leaves it be.
  const hasWork =
    formatMessageCalls.length > 0 ||
    formattedMessages.length > 0 ||
    formatterElements.length > 0 ||
    createIntlDecls.length > 0 ||
    cacheDecls.length > 0 ||
    defineMessagesDecls.length > 0 ||
    providerUnwraps.length > 0 ||
    (!retainProvider && reactIntlImports.length > 0);

  // ---- mutation ------------------------------------------------------------

  // Bindings the mutations below strand: locals the removed createIntl(...)
  // arguments read, and destructured component props the unwrapped <IntlProvider>
  // read. Recorded here, then pruned (only where left unreferenced) as the final
  // AST mutation, so migrated code passes strict unused-variable linting; the
  // react-intl analogue of transformSource step 5 / transformLayout step 7.
  const orphanedArgBindings = new Set<t.Node>();
  const orphanedPropBindings = new Set<t.Node>();

  // 1. createIntl(...) -> await getTranslations(); make the enclosing function
  //    async when it is safe (the awaited component or an already-async fn).
  for (const { declarator, fn } of createIntlDecls) {
    const componentFn = findDefaultExportFunction(ast);
    if (!fn || (!fn.async && fn !== componentFn)) {
      return {
        code: null,
        todos: [],
        skipReasons: [
          'createIntl(...) is not inside an async Server Component; convert it to `await getTranslations()` inside an async component manually',
        ],
      };
    }
    if (!fn.async) fn.async = true;
    // Record the local bindings this createIntl(...) call reads before dropping
    // its arguments object; any left unreferenced by the swap is pruned below.
    // (Imports resolve to a module binding, params to a 'param' binding; both are
    // skipped by the pruner's declarator/prop-only scope, so recording them is
    // harmless.)
    declarator.get('init').traverse({
      ReferencedIdentifier(refPath) {
        const refBinding = refPath.scope.getBinding(refPath.node.name);
        if (refBinding) orphanedArgBindings.add(refBinding.identifier);
      },
    });
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
  // 2b. destructured `const { formatMessage } = useIntl()` ->
  //     `const <local> = useTranslations()` (its bare calls are rewritten in 3,
  //     since `formatMessage` was registered as a binding).
  for (const { path, localName } of useIntlDestructureDecls) {
    path.node.id = t.identifier(localName);
    path.node.init = t.callExpression(t.identifier('useTranslations'), []);
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
    if (bindingName.injected) {
      // An injected useTranslations() hook needs an enclosing function to live
      // in. At module scope (no component) there is nowhere to call it, so
      // emitting the bare call would leave the binding undeclared; skip the
      // whole file rather than write broken code.
      if (!fn) {
        return {
          code: null,
          todos: [],
          skipReasons: [
            `<FormattedMessage id="${id}"> renders at module scope, outside any component, where gt-next's useTranslations() hook cannot be called; move it inside a component or convert manually`,
          ],
        };
      }
      needsClientT = true;
    }
    const args: t.Expression[] = [t.stringLiteral(id)];
    if (values) args.push(values);
    const call = t.callExpression(t.identifier(bindingName.name), args);
    // A JSXExpressionContainer is only valid as a JSX child/attribute. When the
    // element sits in an expression position (return arg, arrow body, const
    // init, object value, ternary branch, array element), replace it with the
    // bare call instead (mirrors the next-intl rich guard in transformSource).
    const parent = element.parent;
    if (t.isJSXElement(parent) || t.isJSXFragment(parent)) {
      element.replaceWith(t.jsxExpressionContainer(call));
    } else {
      element.replaceWith(call);
    }
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
      };
    }
    usedComponents.add(result.component);
  }

  // 6. defineMessages tables become dead once their ids are inlined.
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

  // 7. provider unwrap: <IntlProvider ...>children</IntlProvider> -> <>children</>
  //    (the layout pass inserts the server GTProvider).
  for (const providerPath of providerUnwraps) {
    // Record the destructured props the provider's attributes read (locale,
    // messages, …) before dropping them; any left unreferenced by the unwrap is
    // spliced from the component's own parameter below. children lives in the
    // preserved fragment, so it stays referenced and is never a candidate.
    providerPath.get('openingElement').traverse({
      ReferencedIdentifier(refPath) {
        const refBinding = refPath.scope.getBinding(refPath.node.name);
        if (refBinding && refBinding.kind === 'param') {
          orphanedPropBindings.add(refBinding.identifier);
        }
      },
    });
    const children = providerPath.node.children;
    providerPath.replaceWith(
      t.jsxFragment(t.jsxOpeningFragment(), t.jsxClosingFragment(), children)
    );
  }

  if (!hasWork) {
    return none;
  }

  // General safety net: never strip a react-intl import a remaining reference
  // still needs. If any imported local is still referenced after all planned
  // conversions ran, the plan did not consume it (an unsupported usage form);
  // stripping the import would emit broken code, so skip the whole file. The
  // retained provider (partial migration) is the one intentional exception.
  {
    const importLocals = new Set(symbols.map((symbol) => symbol.local));
    const retainedLocals = retainProvider ? providerLocals : new Set<string>();
    let survivor: string | null = null;
    traverse(ast, {
      ReferencedIdentifier(refPath) {
        const refName = refPath.node.name;
        if (!importLocals.has(refName) || retainedLocals.has(refName)) return;
        survivor = refName;
        refPath.stop();
      },
    });
    if (survivor !== null) {
      return {
        code: null,
        todos: [],
        skipReasons: [
          `react-intl's '${survivor}' is still referenced after conversion (an unsupported usage form); stripping its import would break the file, so it is left untouched; convert manually`,
        ],
      };
    }
  }

  // 8. import surgery.
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

  // Prune the bindings the createIntl swap / provider unwrap left unreferenced.
  // Runs last, after every reference-adding step above, and recrawls so binding
  // reference counts are true; only codemod-stranded bindings are touched.
  if (orphanedArgBindings.size > 0) {
    pruneOrphanedArgBindings(ast, orphanedArgBindings);
  }
  if (orphanedPropBindings.size > 0) {
    pruneOrphanedProps(ast, orphanedPropBindings);
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
  };
}

// ---- helpers ---------------------------------------------------------------

function reasonForUnsupported(imported: string, source: string): string {
  switch (imported) {
    case 'injectIntl':
      return 'injectIntl (class-component HOC) has no gt-next equivalent; convert the class to a function component using useTranslations, or keep it on react-intl';
    case 'RawIntlProvider':
      return 'RawIntlProvider has no gt-next equivalent; gt-next resolves its provider context server-side; wrap your [locale] layout in <GTProvider> instead';
    case 'FormattedList':
    case 'FormattedListParts':
      return 'FormattedList/formatList has no gt-next component in v1 (gt.formatList exists only on the core runtime); convert manually';
    case 'FormattedDisplayName':
      return 'FormattedDisplayName/formatDisplayName has no gt-next component in v1; use getLocaleProperties or convert manually';
    case 'FormattedNumberParts':
    case 'FormattedDateParts':
    case 'FormattedTimeParts':
      return `${imported} (…ToParts) has no gt-next equivalent; convert manually`;
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
 *  absent. Walks the id as a nested dotted path exactly as gt-next's runtime
 *  resolver does (`id.split('.')`), so this migrate-time presence check and the
 *  runtime lookup can never disagree; the catalog is re-nested during discovery
 *  precisely so a dotted id like 'Home.title' resolves here and at runtime. */
function catalogMessage(id: string, ctx: MigrationContext): string | null {
  const catalog = ctx.catalogs.byLocale[ctx.catalogs.defaultLocale] ?? {};
  let current: unknown = catalog;
  for (const segment of id.split('.')) {
    if (
      current === null ||
      typeof current !== 'object' ||
      Array.isArray(current) ||
      !Object.prototype.hasOwnProperty.call(current, segment)
    ) {
      return null;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === 'string' ? current : null;
}

function collisionSkipReason(id: string): string {
  return `'${id}' collides with another catalog key (present both as a value and as a namespace prefix, e.g. 'a' and 'a.b'), which gt-next's nested dictionary cannot represent; rename one of them and re-run gt migrate, or convert manually`;
}

/** True for the FormatJS auto-generated-id shape: a descriptor with a literal
 *  `defaultMessage` but no literal `id` (ids are hashed at build time), so there
 *  is no dictionary key to resolve against. */
function isAutoIdDescriptor(node: t.Node | undefined): boolean {
  if (!node) return false;
  let object: t.ObjectExpression | null = null;
  if (t.isObjectExpression(node)) {
    object = node;
  } else if (
    t.isCallExpression(node) &&
    t.isIdentifier(node.callee, { name: 'defineMessage' }) &&
    t.isObjectExpression(node.arguments[0])
  ) {
    object = node.arguments[0];
  }
  if (!object) return false;
  const idProp = getObjectProp(object, 'id');
  const dmProp = getObjectProp(object, 'defaultMessage');
  const hasLiteralId = idProp !== null && t.isStringLiteral(idProp);
  const hasDefaultMessage = dmProp !== null && t.isStringLiteral(dmProp);
  return !hasLiteralId && hasDefaultMessage;
}

const AUTO_ID_WARNING =
  'This project uses FormatJS auto-generated ids (a `defaultMessage` with no ' +
  'literal `id`; ids are hashed at build time via overrideIdFn/' +
  'idInterpolationPattern). gt-next needs a literal id per message, so every ' +
  'file that renders text this way is skipped and NOT converted in v1. To ' +
  'migrate them, add explicit `id`s to your messages (or convert those files by ' +
  'hand), then re-run gt migrate.';

/** Provider attributes the unwrap can safely drop: locale/defaultLocale/messages
 *  are subsumed by gt-next's <GTProvider>, and key/ref are React reserved props
 *  (not react-intl config), so dropping them changes nothing at runtime. */
const PROVIDER_SAFE_PROPS = new Set([
  'locale',
  'defaultLocale',
  'messages',
  'key',
  'ref',
]);

/** Per-prop note explaining what dropping a given <IntlProvider> config prop
 *  would change, so each skip reason names only the prop actually present
 *  instead of lecturing about every possible one. */
const PROVIDER_PROP_NOTES: Record<string, string> = {
  onError: 'routes format and missing-key errors to your telemetry',
  textComponent: 'changes the DOM wrapper element around formatted messages',
  formats: 'defines custom date/number/time format styles',
  defaultFormats: 'defines fallback format styles',
  defaultRichTextElements: 'sets default rich-text tag renderers',
  wrapRichTextChunksInFragment: 'controls how rich-text chunks are wrapped',
  onWarn: 'routes formatting warnings to your handler',
};

/** Skip reasons for the attributes an <IntlProvider> carries beyond the safe
 *  set, each of which would be silently dropped by the unwrap. timeZone gets its
 *  own message because it changes every date/time render. Returns [] when only
 *  the safe props (config subsumed by GTProvider, or React key/ref) are present. */
function providerDropReasons(opening: t.JSXOpeningElement): string[] {
  const reasons: string[] = [];
  for (const attr of opening.attributes) {
    if (t.isJSXSpreadAttribute(attr)) {
      reasons.push(
        '<IntlProvider> uses spread props ({...props}) that cannot be inspected; it may carry timeZone/onError/textComponent/formats that gt-next handles differently; convert this provider manually'
      );
      continue;
    }
    if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name)) continue;
    const name = attr.name.name;
    if (PROVIDER_SAFE_PROPS.has(name)) continue;
    if (name === 'timeZone') {
      reasons.push(
        '<IntlProvider> sets `timeZone`; gt-next resolves timezone differently, and dropping it changes every <FormattedDate>/<FormattedTime> render (server/visitor zone instead of the pinned one). Set the timezone in your gt config and verify date output, then remove it and re-run gt migrate; converting this file now would drop it silently'
      );
      continue;
    }
    const note = PROVIDER_PROP_NOTES[name];
    const detail = note ? ` (it ${note})` : '';
    reasons.push(
      `<IntlProvider> sets \`${name}\`, which has no gt-next <GTProvider> equivalent and would be dropped silently${detail}; convert this provider manually`
    );
  }
  return reasons;
}

/** True when a formatMessage message contains rich-text tags, or its values
 *  include a chunk function or a JSX element/fragment; either way the
 *  dictionary t() (string result) cannot render it. */
function isRichOrHasFunctionValues(
  message: string | null,
  valuesArg: t.Node | undefined
): boolean {
  if (message !== null && classifyMessage(message).kind === 'tags') return true;
  if (valuesArg && t.isObjectExpression(valuesArg)) {
    return valuesArg.properties.some(isRichValueProperty);
  }
  return false;
}

/** Why a <FormattedMessage> is not a plain dictionary lookup: 'tags' when the
 *  message text carries rich-text tags (needs component rendering), 'value' when
 *  a `values` entry is a chunk function / JSX element (a React node the string
 *  t() cannot return), or 'plain' otherwise. Distinguished so the skip reason can
 *  name the actual trigger. Unknown messages are treated as plain. */
function analyzeRich(
  message: string | null,
  valuesExpr: t.Expression | null
): 'tags' | 'value' | 'plain' {
  if (message !== null && classifyMessage(message).kind === 'tags') {
    return 'tags';
  }
  if (
    valuesExpr &&
    t.isObjectExpression(valuesExpr) &&
    valuesExpr.properties.some(isRichValueProperty)
  ) {
    return 'value';
  }
  return 'plain';
}

/** A `values` entry whose value is a chunk wrapper function or a JSX
 *  element/fragment (both produce React nodes at runtime), so the message is
 *  rich (the dictionary path skips with a reason). */
function isRichValueProperty(property: t.ObjectProperty | t.Node): boolean {
  return (
    t.isObjectProperty(property) &&
    (t.isArrowFunctionExpression(property.value) ||
      t.isFunctionExpression(property.value) ||
      t.isJSXElement(property.value) ||
      t.isJSXFragment(property.value))
  );
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
      skip: `<${kind}> uses spread props that cannot be mapped to gt-next options; convert manually`,
    };
  }

  if (kind === 'FormattedPlural') {
    const value = jsxAttr(opening, 'value');
    if (!value || !t.isJSXExpressionContainer(value.value)) {
      return {
        skip: '<FormattedPlural> needs a `value={…}` expression; convert manually',
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
          reason: `<Plural>: dropped <FormattedPlural> prop \`${name}\` (no gt-next equivalent); verify output`,
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
            '<RelativeTime>: react-intl auto-updated (updateIntervalInSeconds); gt-next renders a static value; add your own timer if a live tick is required',
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
      skip: `<${kind}> needs a \`value={…}\` expression; convert manually`,
    };
  }
  const valueExpr = value.value.expression;
  if (!t.isExpression(valueExpr)) {
    return {
      skip: `<${kind}> has an unsupported \`value\`; convert manually`,
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
        skip: `<${kind}> prop \`${attr.name.name}\` cannot be mapped to gt-next options; convert manually`,
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

function enclosingFunction(path: NodePath): t.Function | null {
  const fn = path.getFunctionParent();
  return fn ? fn.node : null;
}

/** Component higher-order-component wrappers whose function argument is still a
 *  component that may legally own hooks (unlike a plain callback such as .map). */
const COMPONENT_HOCS = new Set(['memo', 'forwardRef']);

function isComponentHocCall(node: t.Node): boolean {
  if (!t.isCallExpression(node)) return false;
  const callee = node.callee;
  if (t.isIdentifier(callee)) return COMPONENT_HOCS.has(callee.name);
  // React.memo(...) / React.forwardRef(...)
  if (
    t.isMemberExpression(callee) &&
    !callee.computed &&
    t.isIdentifier(callee.property)
  ) {
    return COMPONENT_HOCS.has(callee.property.name);
  }
  return false;
}

/** True when `fnPath` names a function that can legally own a React hook: a
 *  function declaration, a function/arrow assigned to a variable, a default
 *  export, or one wrapped in a component HOC (memo/forwardRef). A function that
 *  is a plain call argument (a callback like .map/.forEach/useMemo) cannot. */
function isLegalHookOwner(fnPath: NodePath<t.Function>): boolean {
  const node = fnPath.node;
  if (t.isFunctionDeclaration(node)) return true;
  if (!t.isArrowFunctionExpression(node) && !t.isFunctionExpression(node)) {
    // object/class methods are not treated as hook owners here.
    return false;
  }
  const parent = fnPath.parent;
  if (t.isVariableDeclarator(parent) && parent.init === node) return true;
  if (t.isExportDefaultDeclaration(parent)) return true;
  if (
    isComponentHocCall(parent) &&
    t.isCallExpression(parent) &&
    parent.arguments.includes(node)
  ) {
    return true;
  }
  return false;
}

/** The function an injected useTranslations() hook must live in: the nearest
 *  enclosing function that can legally own a hook, climbing past callbacks
 *  (functions passed as call arguments, e.g. items.map(item => …)) that would
 *  otherwise capture the hook and produce a rules-of-hooks violation. Returns
 *  null when no legal owner exists (module scope or callbacks all the way up),
 *  which the caller turns into a whole-file skip. */
function hookOwnerFunction(path: NodePath): t.Function | null {
  let fnPath = path.getFunctionParent();
  while (fnPath) {
    if (isLegalHookOwner(fnPath)) return fnPath.node;
    fnPath = fnPath.getFunctionParent();
  }
  return null;
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
    if (bindingFn === null) {
      // Unreachable for a real file: a module-scope client binding (null
      // enclosing function) is invalid react-intl and is skip+reported before
      // any mutation runs (see the module-scope useIntl guard earlier in this
      // function, which makes skipReasons non-empty and forces an early return).
      // So a client binding that survives to here always has a recorded
      // function. Assert the invariant instead of silently reusing a binding
      // that would encode a rules-of-hooks violation.
      throw new Error(
        `internal invariant: module-scope client binding '${name}' reached translationBindingFor; it must be skipped upstream`
      );
    }
    // An intl binding declared in this same function: reuse it in place.
    if (bindingFn === fn) {
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

/** Inserts `const <name> = useTranslations();` at the top of a function body.
 *  An implicit-body arrow (`() => <expr>`) is first converted to a block
 *  (`() => { const <name> = useTranslations(); return <expr>; }`), so the hook
 *  the caller already emitted as `<name>(...)` always has its declaration;
 *  emitting the call without it would leave `<name>` undeclared (TS2304 at
 *  typecheck, ReferenceError at render). Only arrows can have a non-block body. */
function insertHookDeclaration(fn: t.Function, name: string): void {
  const declaration = t.variableDeclaration('const', [
    t.variableDeclarator(
      t.identifier(name),
      t.callExpression(t.identifier('useTranslations'), [])
    ),
  ]);
  if (t.isBlockStatement(fn.body)) {
    fn.body.body.unshift(declaration);
    return;
  }
  if (t.isArrowFunctionExpression(fn) && t.isExpression(fn.body)) {
    fn.body = t.blockStatement([declaration, t.returnStatement(fn.body)]);
  }
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

/** Removes a variable declarator, dropping the whole declaration when it is the
 *  only one (an empty `const;` is invalid). Mirrors the createIntlCache /
 *  defineMessages cleanups. */
function removeDeclarator(path: NodePath<t.VariableDeclarator>): void {
  const declaration = path.parentPath;
  if (
    declaration.isVariableDeclaration() &&
    declaration.node.declarations.length === 1
  ) {
    declaration.remove();
  } else {
    path.remove();
  }
}

/**
 * Prunes local bindings the removed createIntl(...) arguments object was the sole
 * consumer of, so the getTranslations() swap leaves no unused-variable defect. A
 * `const { locale } = …` object pattern is property-spliced (a RestElement sibling
 * aborts it; the rest would absorb the key); a plain declarator goes whole only
 * when unreferenced. Function parameters and types are never touched. Recrawls
 * each pass and loops to a fixpoint so a chain (`messages` → `locale`) unwinds.
 */
function pruneOrphanedArgBindings(ast: t.File, targets: Set<t.Node>): void {
  // Functions whose route-param destructure (`const { locale } = await
  // params`) was removed whole: the enclosing `params` parameter is then
  // judged by its own recrawled binding below and dropped when nothing else
  // reads it, so the emitted file passes no-unused-vars (same treatment the
  // layout and next-intl page cleanups apply).
  const paramsCleanupTargets = new Set<t.Function>();
  let removedAny = true;
  while (removedAny) {
    removedAny = false;
    traverse(ast, {
      Program(path) {
        // Recrawl so bindings reflect every mutation (and prior pass) above.
        path.scope.crawl();
      },
      VariableDeclarator(path) {
        const id = path.node.id;
        if (t.isIdentifier(id)) {
          if (!targets.has(id)) return;
          const binding = path.scope.getBinding(id.name);
          if (!binding || binding.referenced) return;
          removeDeclarator(path);
          removedAny = true;
          return;
        }
        if (!t.isObjectPattern(id)) return;
        // A rest sibling would absorb the removed key at runtime; leave it be.
        if (id.properties.some((property) => t.isRestElement(property))) return;
        const remove = new Set<t.Node>();
        for (const property of id.properties) {
          if (
            !t.isObjectProperty(property) ||
            property.computed ||
            !t.isIdentifier(property.value) ||
            !targets.has(property.value)
          ) {
            continue;
          }
          const binding = path.scope.getBinding(property.value.name);
          if (binding && !binding.referenced) remove.add(property);
        }
        if (remove.size === 0) return;
        id.properties = id.properties.filter(
          (property) => !remove.has(property)
        );
        removedAny = true;
        // An emptied pattern (`const {} = …`) is invalid; drop the declarator.
        if (id.properties.length === 0) {
          if (isParamsInit(path.node.init)) {
            const fn = path.getFunctionParent();
            if (fn) paramsCleanupTargets.add(fn.node);
          }
          removeDeclarator(path);
        }
      },
    });
  }
  if (paramsCleanupTargets.size === 0) return;
  traverse(ast, {
    Program(path) {
      // The destructure removals above stranded `params`; recrawl before
      // judging its binding.
      path.scope.crawl();
    },
    Function(path) {
      if (!paramsCleanupTargets.has(path.node)) return;
      const binding = path.scope.getBinding('params');
      if (!binding || binding.kind !== 'param' || binding.referenced) return;
      removeParamsParameter(path.node);
    },
  });
}

/**
 * Prunes destructured component props the unwrapped <IntlProvider> was the sole
 * consumer of (`function W({ locale, messages, children })` → `{ children }`).
 * Same safety rules as transformLayout step 7: a RestElement sibling aborts the
 * splice, the TypeScript annotation is left untouched, and the recrawled binding
 * of the function's own scope decides; a prop still read elsewhere survives.
 */
function pruneOrphanedProps(ast: t.File, targets: Set<t.Node>): void {
  traverse(ast, {
    Program(path) {
      path.scope.crawl();
    },
    Function(path) {
      for (const param of path.node.params) {
        if (!t.isObjectPattern(param)) continue;
        if (param.properties.some((property) => t.isRestElement(property))) {
          continue;
        }
        const remove = new Set<t.Node>();
        for (const property of param.properties) {
          if (
            !t.isObjectProperty(property) ||
            property.computed ||
            !t.isIdentifier(property.value) ||
            !targets.has(property.value)
          ) {
            continue;
          }
          const binding = path.scope.getBinding(property.value.name);
          if (binding && !binding.referenced) remove.add(property);
        }
        if (remove.size === 0) continue;
        param.properties = param.properties.filter(
          (property) => !remove.has(property)
        );
      }
    },
  });
}
