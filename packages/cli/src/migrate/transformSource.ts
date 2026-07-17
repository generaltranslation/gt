import { parse } from '@babel/parser';
import traverseModule, { type NodePath } from '@babel/traverse';
import generateModule from '@babel/generator';
import * as t from '@babel/types';
import {
  isTagElement,
  parse as parseIcu,
  type MessageFormatElement,
} from '@formatjs/icu-messageformat-parser';
import { classifyMessage } from './classifyMessage.js';
import type { MigrationContext, SourceResult, TodoEntry } from './types.js';

const traverse = traverseModule.default || traverseModule;
const generate = generateModule.default || generateModule;

/** next-intl symbol -> gt-next module it moves to, keeping the same name. */
const CLIENT_SWAPS = new Set(['useTranslations', 'useLocale']);
const SERVER_SWAPS = new Set(['getTranslations', 'getLocale']);
const REMOVALS = new Set(['setRequestLocale', 'unstable_setRequestLocale']);
const PROVIDER = 'NextIntlClientProvider';
/**
 * A pure type next-intl derives from the routing config (a string union).
 * gt-next has no equivalent export, so it never justifies a skip. In a full
 * conversion (next-intl removed) its references are rewritten to `string` and
 * the specifier is dropped; in a partial migration (next-intl retained) the
 * specifier and its references are kept so the augmented `Locale` union — the
 * type the retained NextIntlClientProvider's `locale` prop expects — survives.
 */
const LOCALE_TYPE = 'Locale';
const MESSAGES_HOOKS = new Set(['useMessages', 'getMessages']);
const GT_MODULE = 'gt-next';
const GT_SERVER_MODULE = 'gt-next/server';

type TransformOptions = {
  /**
   * Leave NextIntlClientProvider (and its next-intl import) untouched so a
   * later pass can nest it inside GTProvider while skipped files remain.
   */
  retainNextIntlProvider?: boolean;
  /**
   * Treat hasLocale as supported (its guard is removed by the layout pass)
   * instead of skipping the file.
   */
  dropLocaleValidation?: boolean;
};

type ImportedSymbol = {
  imported: string;
  local: string;
  source: string;
  specifier: t.ImportSpecifier;
  declaration: NodePath<t.ImportDeclaration>;
};

export function transformSourceFile(
  file: string,
  code: string,
  ctx: MigrationContext,
  options: TransformOptions = {}
): SourceResult {
  const none: SourceResult = {
    code: null,
    todos: [],
    skipReasons: [],
    usedRich: false,
  };
  if (!/['"]next-intl(?:\/[^'"]*)?['"]/.test(code)) return none;

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

  const skipReasons: string[] = [];
  const todos: TodoEntry[] = [];
  const symbols: ImportedSymbol[] = [];
  const nextIntlImports: NodePath<t.ImportDeclaration>[] = [];
  let hasNextIntlReexport = false;

  const noteReexport = (source: string) => {
    if (source !== 'next-intl' && !source.startsWith('next-intl/')) return;
    hasNextIntlReexport = true;
    skipReasons.push(
      `re-export from '${source}' would break once next-intl is removed (convert the re-export manually)`
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
      if (source !== 'next-intl' && !source.startsWith('next-intl/')) return;
      nextIntlImports.push(path);
      for (const specifier of path.node.specifiers) {
        if (!t.isImportSpecifier(specifier)) {
          skipReasons.push(
            `unsupported next-intl import form from '${source}'`
          );
          continue;
        }
        const imported = t.isIdentifier(specifier.imported)
          ? specifier.imported.name
          : specifier.imported.value;
        symbols.push({
          imported,
          local: specifier.local.name,
          source,
          specifier,
          declaration: path,
        });
      }
    },
  });
  if (nextIntlImports.length === 0 && !hasNextIntlReexport) return none;

  // The exact `Locale` import specifiers (value- or type-position, aliased or
  // not). References that bind to one of these are rewritten to `string`; a
  // user's own local `Locale` type has no such binding and is left alone.
  const localeSpecifierNodes = new Set<t.Node>(
    symbols
      .filter((symbol) => symbol.imported === LOCALE_TYPE)
      .map((symbol) => symbol.specifier)
  );

  const providerRetained = options.retainNextIntlProvider === true;
  for (const symbol of symbols) {
    const supported =
      CLIENT_SWAPS.has(symbol.imported) ||
      SERVER_SWAPS.has(symbol.imported) ||
      REMOVALS.has(symbol.imported) ||
      MESSAGES_HOOKS.has(symbol.imported) ||
      symbol.imported === PROVIDER ||
      symbol.imported === LOCALE_TYPE ||
      (options.dropLocaleValidation === true &&
        symbol.imported === 'hasLocale');
    if (!supported) {
      skipReasons.push(
        `unsupported next-intl API: ${symbol.imported} (from '${symbol.source}')`
      );
    }
  }

  const localsBy = (predicate: (imported: string) => boolean) =>
    new Set(symbols.filter((s) => predicate(s.imported)).map((s) => s.local));
  const translationHookLocals = localsBy(
    (name) => name === 'useTranslations' || name === 'getTranslations'
  );
  const getTranslationsLocals = localsBy((name) => name === 'getTranslations');
  const removalLocals = localsBy((name) => REMOVALS.has(name));
  const messagesHookLocals = localsBy((name) => MESSAGES_HOOKS.has(name));
  const providerLocals = localsBy((name) => name === PROVIDER);

  // ---- analysis pass -------------------------------------------------------

  const tBindings = new Map<string, { namespace: string | null }>();
  const richConversions: {
    container: NodePath<t.JSXExpressionContainer>;
    elements: MessageFormatElement[];
    chunkMap: Map<string, t.JSXElement>;
  }[] = [];
  const objectArgRewrites: {
    call: t.CallExpression;
    namespace: string | null;
    hadLocale: boolean;
    line?: number;
  }[] = [];
  const providerElements: NodePath<t.JSXElement>[] = [];
  const strippedAttrIdentifiers = new Set<string>();
  let needsT = false;

  traverse(ast, {
    VariableDeclarator(path) {
      const init = unwrapAwait(path.node.init);
      if (
        init &&
        t.isCallExpression(init) &&
        t.isIdentifier(init.callee) &&
        translationHookLocals.has(init.callee.name) &&
        t.isIdentifier(path.node.id)
      ) {
        const first = init.arguments[0];
        tBindings.set(path.node.id.name, {
          namespace: t.isStringLiteral(first) ? first.value : null,
        });
        if (
          t.isObjectExpression(first) &&
          t.isIdentifier(init.callee) &&
          getTranslationsLocals.has(init.callee.name)
        ) {
          const namespaceProp = getObjectProp(first, 'namespace');
          const namespace =
            namespaceProp && t.isStringLiteral(namespaceProp)
              ? namespaceProp.value
              : null;
          const hadLocale = getObjectProp(first, 'locale') !== null;
          objectArgRewrites.push({
            call: init,
            namespace,
            hadLocale,
            line: init.loc?.start.line,
          });
          tBindings.set(path.node.id.name, { namespace });
        }
      }
    },
    JSXElement(path) {
      const name = path.node.openingElement.name;
      if (t.isJSXIdentifier(name) && providerLocals.has(name.name)) {
        providerElements.push(path);
        for (const attr of path.node.openingElement.attributes) {
          if (
            t.isJSXAttribute(attr) &&
            t.isJSXExpressionContainer(attr.value) &&
            t.isIdentifier(attr.value.expression)
          ) {
            strippedAttrIdentifiers.add(attr.value.expression.name);
          }
        }
      }
    },
  });

  traverse(ast, {
    CallExpression(path) {
      const callee = path.node.callee;
      // t.rich / t.raw / t.markup / t.has
      if (
        t.isMemberExpression(callee) &&
        t.isIdentifier(callee.object) &&
        tBindings.has(callee.object.name) &&
        t.isIdentifier(callee.property)
      ) {
        const method = callee.property.name;
        if (method === 'rich') {
          // Converting t.rich to inline <T> embeds the source-language
          // message; the key's existing translations stop applying until
          // regenerated. That trade is opt-in via --inline — the default
          // mode's promise is zero translation loss.
          if (!ctx.inlineMode) {
            skipReasons.push(
              't.rich(...) conversion discards existing translations for the key — re-run with --inline to opt in, or convert manually'
            );
          } else {
            const conversion = analyzeRichCall(
              path,
              tBindings.get(callee.object.name)!.namespace,
              ctx
            );
            if (typeof conversion === 'string') {
              skipReasons.push(conversion);
            } else {
              richConversions.push(conversion);
              needsT = true;
              todos.push({
                file,
                line: path.node.loc?.start.line,
                reason: `t.rich(...) converted to inline <T> — regenerate translations for this content (\`npx gt translate\`)`,
              });
            }
          }
        } else if (['raw', 'markup', 'has'].includes(method)) {
          skipReasons.push(
            `t.${method}(...) has no gt-next equivalent yet (manual conversion)`
          );
        }
      }
    },
    Identifier(path) {
      // messages-hook references that don't feed a (stripped) provider prop
      if (
        messagesHookLocals.has(path.node.name) &&
        path.isReferencedIdentifier() &&
        !t.isImportSpecifier(path.parent)
      ) {
        const declarator = path.findParent((p) => p.isVariableDeclarator());
        const declaratorNode =
          declarator && declarator.isVariableDeclarator()
            ? declarator.node
            : null;
        const id =
          declaratorNode && t.isIdentifier(declaratorNode.id)
            ? declaratorNode.id.name
            : null;
        if (
          !id ||
          !isProviderOnlyBinding(
            id,
            ast,
            strippedAttrIdentifiers,
            providerElements
          )
        ) {
          skipReasons.push(
            `${path.node.name}() is used outside a provider prop (manual conversion)`
          );
        }
      }
    },
  });

  if (providerRetained && providerElements.length > 0) {
    // Keep the provider element and its import on next-intl untouched.
    providerElements.length = 0;
  }

  // Local identifier `T` that is not gt's would collide with rich conversion.
  if (needsT && hasForeignTBinding(ast)) {
    skipReasons.push(
      "local identifier 'T' collides with gt-next's <T> (manual conversion)"
    );
  }

  const uniqueSkips = [...new Set(skipReasons)];
  if (uniqueSkips.length > 0) {
    return { code: null, todos: [], skipReasons: uniqueSkips, usedRich: false };
  }

  // ---- mutation pass -------------------------------------------------------

  // 0. `Locale` -> `string`, full-conversion only. Only references bound to the
  //    next-intl import are touched (scope-checked), so a user's own local
  //    `Locale` type survives. The specifier is dropped later by the import
  //    surgery. In a partial migration next-intl stays installed, so both the
  //    `Locale` specifier and its references are retained (see import surgery)
  //    to keep the precise augmented union.
  if (localeSpecifierNodes.size > 0 && !providerRetained) {
    traverse(ast, {
      TSAsExpression(path) {
        // `x as Locale` -> `x`: drop the cast entirely (string is inferred).
        const annotation = path.node.typeAnnotation;
        if (
          t.isTSTypeReference(annotation) &&
          t.isIdentifier(annotation.typeName) &&
          bindsToNextIntlLocale(
            path,
            annotation.typeName.name,
            localeSpecifierNodes
          )
        ) {
          path.replaceWith(path.node.expression);
        }
      },
      TSTypeReference(path) {
        // `locale: Locale`, `Promise<{ locale: Locale }>`, etc. -> `string`.
        const typeName = path.node.typeName;
        if (
          t.isIdentifier(typeName) &&
          bindsToNextIntlLocale(path, typeName.name, localeSpecifierNodes)
        ) {
          path.replaceWith(t.tsStringKeyword());
        }
      },
    });
  }

  // 1. setRequestLocale call statements.
  traverse(ast, {
    ExpressionStatement(path) {
      const expression = unwrapAwait(path.node.expression);
      if (
        expression &&
        t.isCallExpression(expression) &&
        t.isIdentifier(expression.callee) &&
        removalLocals.has(expression.callee.name)
      ) {
        path.remove();
      }
    },
  });

  // 2. getTranslations({ locale, namespace }) -> getTranslations('namespace').
  for (const rewrite of objectArgRewrites) {
    rewrite.call.arguments = rewrite.namespace
      ? [t.stringLiteral(rewrite.namespace)]
      : [];
    if (rewrite.hadLocale) {
      todos.push({
        file,
        line: rewrite.line,
        reason:
          'getTranslations locale override dropped — gt-next resolves the request locale itself; use options.$locale on individual calls if a fixed locale was intended',
      });
    }
  }

  // 3. t.rich conversions.
  for (const conversion of richConversions) {
    const children = icuToJsxChildren(conversion.elements, conversion.chunkMap);
    const tElement = t.jsxElement(
      t.jsxOpeningElement(t.jsxIdentifier('T'), []),
      t.jsxClosingElement(t.jsxIdentifier('T')),
      children
    );
    conversion.container.replaceWith(tElement);
  }

  // 4. Provider swap + linked messages cleanup.
  const removedProviderMessageBindings = new Set<string>();
  for (const providerPath of providerElements) {
    const opening = providerPath.node.openingElement;
    opening.name = t.jsxIdentifier('GTProvider');
    opening.attributes = [];
    if (providerPath.node.closingElement) {
      providerPath.node.closingElement.name = t.jsxIdentifier('GTProvider');
    }
  }
  if (providerElements.length > 0) {
    traverse(ast, {
      VariableDeclarator(path) {
        if (
          t.isIdentifier(path.node.id) &&
          strippedAttrIdentifiers.has(path.node.id.name)
        ) {
          const init = unwrapAwait(path.node.init);
          if (
            init &&
            t.isCallExpression(init) &&
            t.isIdentifier(init.callee) &&
            messagesHookLocals.has(init.callee.name)
          ) {
            removedProviderMessageBindings.add(init.callee.name);
            path.remove();
          }
        }
      },
    });
  }

  // 5. Import surgery.
  const clientSpecifiers: t.ImportSpecifier[] = [];
  const serverSpecifiers: t.ImportSpecifier[] = [];
  for (const symbol of symbols) {
    if (CLIENT_SWAPS.has(symbol.imported)) {
      clientSpecifiers.push(symbol.specifier);
    } else if (SERVER_SWAPS.has(symbol.imported)) {
      serverSpecifiers.push(symbol.specifier);
    } else if (symbol.imported === PROVIDER && !providerRetained) {
      clientSpecifiers.push(
        t.importSpecifier(
          t.identifier('GTProvider'),
          t.identifier('GTProvider')
        )
      );
    }
    // REMOVALS and provider-linked messages hooks simply disappear.
  }
  if (needsT) {
    clientSpecifiers.push(
      t.importSpecifier(t.identifier('T'), t.identifier('T'))
    );
  }

  const newDeclarations: t.ImportDeclaration[] = [];
  const mergeTargets = new Map<string, t.ImportDeclaration>();
  traverse(ast, {
    ImportDeclaration(path) {
      const source = path.node.source.value;
      if (
        (source === GT_MODULE || source === GT_SERVER_MODULE) &&
        !mergeTargets.has(source)
      ) {
        mergeTargets.set(source, path.node);
      }
    },
  });

  for (const [module, specifiers] of [
    [GT_MODULE, clientSpecifiers],
    [GT_SERVER_MODULE, serverSpecifiers],
  ] as const) {
    const unique = dedupeSpecifiers(specifiers, mergeTargets.get(module));
    if (unique.length === 0) continue;
    const existing = mergeTargets.get(module);
    if (existing) {
      existing.specifiers.push(...unique);
    } else {
      newDeclarations.push(
        t.importDeclaration(unique, t.stringLiteral(module))
      );
    }
  }

  let insertedNewDeclarations = false;
  for (const importPath of nextIntlImports) {
    let kept: t.ImportSpecifier[] = [];
    if (providerRetained) {
      // next-intl stays installed, so keep the retained provider, the `Locale`
      // type (its precise augmented union still applies), a still-referenced
      // hasLocale locale guard, and any provider-linked messages hooks. Any
      // `Locale` specifier left unreferenced is pruned below.
      kept = importPath.node.specifiers.filter(
        (specifier): specifier is t.ImportSpecifier =>
          t.isImportSpecifier(specifier) &&
          t.isIdentifier(specifier.imported) &&
          (specifier.imported.name === PROVIDER ||
            specifier.imported.name === LOCALE_TYPE ||
            specifier.imported.name === 'hasLocale' ||
            (MESSAGES_HOOKS.has(specifier.imported.name) &&
              !removedProviderMessageBindings.has(specifier.local.name)))
      );
    }
    if (kept.length > 0) {
      importPath.node.specifiers = kept;
      if (!insertedNewDeclarations && newDeclarations.length > 0) {
        importPath.insertAfter(newDeclarations);
        insertedNewDeclarations = true;
      }
    } else if (!insertedNewDeclarations && newDeclarations.length > 0) {
      importPath.replaceWithMultiple(newDeclarations);
      insertedNewDeclarations = true;
    } else {
      importPath.remove();
    }
  }

  // Partial migration: the next-intl `Locale` import was retained above, but
  // its only reference may have been removed by another rewrite (e.g. an
  // `as Locale` cast inside a getTranslations object arg). Drop any retained
  // Locale specifier that no longer has a reference so we never emit a dead
  // import; a specifier still used by a surviving type annotation stays.
  if (providerRetained) {
    const localeLocals = new Set(
      symbols
        .filter((symbol) => symbol.imported === LOCALE_TYPE)
        .map((symbol) => symbol.local)
    );
    if (localeLocals.size > 0) {
      const referenced = new Set<string>();
      traverse(ast, {
        Identifier(path) {
          if (!localeLocals.has(path.node.name)) return;
          if (path.findParent((parent) => parent.isImportDeclaration())) return;
          referenced.add(path.node.name);
        },
      });
      traverse(ast, {
        ImportDeclaration(path) {
          const source = path.node.source.value;
          if (source !== 'next-intl' && !source.startsWith('next-intl/')) {
            return;
          }
          path.node.specifiers = path.node.specifiers.filter(
            (specifier) =>
              !(
                t.isImportSpecifier(specifier) &&
                localeLocals.has(specifier.local.name) &&
                !referenced.has(specifier.local.name)
              )
          );
          if (path.node.specifiers.length === 0) path.remove();
        },
      });
    }
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
    usedRich: richConversions.length > 0,
  };
}

// ---- helpers ---------------------------------------------------------------

/**
 * True when the type identifier `name` resolves to one of the collected
 * next-intl `Locale` import specifiers. Scope-aware, so a shadowing local
 * binding (or a user's own `Locale` type, which carries no binding) is not
 * mistaken for the import.
 */
function bindsToNextIntlLocale(
  path: NodePath,
  name: string,
  localeSpecifierNodes: Set<t.Node>
): boolean {
  const binding = path.scope.getBinding(name);
  return binding != null && localeSpecifierNodes.has(binding.path.node);
}

function unwrapAwait(node: t.Node | null | undefined): t.Expression | null {
  if (!node) return null;
  let current: t.Node = node;
  for (;;) {
    if (t.isAwaitExpression(current)) {
      current = current.argument;
    } else if (t.isParenthesizedExpression(current)) {
      current = current.expression;
    } else {
      break;
    }
  }
  return t.isExpression(current) ? current : null;
}

function unwrapParens(node: t.Node): t.Node {
  let current = node;
  while (t.isParenthesizedExpression(current)) {
    current = current.expression;
  }
  return current;
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

/** Resolves a dotted path like 'Home.welcome' through a nested catalog. */
function resolveMessage(
  catalog: Record<string, unknown>,
  namespace: string | null,
  key: string
): string | null {
  const fullPath = namespace ? `${namespace}.${key}` : key;
  let current: unknown = catalog;
  for (const segment of fullPath.split('.')) {
    if (
      current === null ||
      typeof current !== 'object' ||
      !(segment in (current as Record<string, unknown>))
    ) {
      return null;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === 'string' ? current : null;
}

/**
 * A t.rich call is convertible when the key is a string literal resolving to
 * a tags-only message and every value is a trivial chunk wrapper like
 * `(chunks) => <b>{chunks}</b>`.
 */
function analyzeRichCall(
  path: NodePath<t.CallExpression>,
  namespace: string | null,
  ctx: MigrationContext
):
  | string
  | {
      container: NodePath<t.JSXExpressionContainer>;
      elements: MessageFormatElement[];
      chunkMap: Map<string, t.JSXElement>;
    } {
  const manual = 't.rich(...) needs manual conversion';
  const [keyArg, valuesArg] = path.node.arguments;
  if (!t.isStringLiteral(keyArg)) return manual;

  const message = resolveMessage(
    ctx.catalogs.byLocale[ctx.catalogs.defaultLocale] ?? {},
    namespace,
    keyArg.value
  );
  if (!message) return `t.rich('${keyArg.value}') key not found in catalog`;
  const classified = classifyMessage(message);
  if (classified.kind !== 'tags' || classified.argNames.length > 0) {
    return manual;
  }

  const chunkMap = new Map<string, t.JSXElement>();
  if (valuesArg !== undefined) {
    if (!t.isObjectExpression(valuesArg)) return manual;
    for (const property of valuesArg.properties) {
      if (
        !t.isObjectProperty(property) ||
        property.computed ||
        !t.isIdentifier(property.key)
      ) {
        return manual;
      }
      const element = trivialChunkElement(property.value);
      if (!element) return manual;
      chunkMap.set(property.key.name, element);
    }
  }

  let elements: MessageFormatElement[];
  try {
    elements = parseIcu(message);
  } catch {
    return manual;
  }
  if (!allTagsMapped(elements, chunkMap)) return manual;

  const container = path.parentPath;
  if (
    !container.isJSXExpressionContainer() ||
    !(t.isJSXElement(container.parent) || t.isJSXFragment(container.parent))
  ) {
    return manual;
  }

  return { container, elements, chunkMap };
}

/** Matches `(chunks) => <b ...>{chunks}</b>` (implicit return only). */
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

/**
 * True when `bindingName` was passed as a provider prop AND has no other
 * reference in the file. The provider swap removes both the prop and the
 * declaration, so any surviving reference (`<Child messages={messages} />`)
 * would dangle — those files must be skipped instead.
 */
function isProviderOnlyBinding(
  bindingName: string,
  ast: t.File,
  strippedAttrIdentifiers: Set<string>,
  providerElements: NodePath<t.JSXElement>[]
): boolean {
  if (!strippedAttrIdentifiers.has(bindingName)) return false;

  const providerAttrExpressions = new Set<t.Node>();
  for (const providerPath of providerElements) {
    for (const attr of providerPath.node.openingElement.attributes) {
      if (
        t.isJSXAttribute(attr) &&
        t.isJSXExpressionContainer(attr.value) &&
        t.isIdentifier(attr.value.expression)
      ) {
        providerAttrExpressions.add(attr.value.expression);
      }
    }
  }

  let referencedElsewhere = false;
  traverse(ast, {
    Identifier(path) {
      if (path.node.name !== bindingName) return;
      if (!path.isReferencedIdentifier()) return;
      if (providerAttrExpressions.has(path.node)) return;
      referencedElsewhere = true;
    },
  });
  return !referencedElsewhere;
}

function hasForeignTBinding(ast: t.File): boolean {
  let foreign = false;
  traverse(ast, {
    ImportSpecifier(path) {
      const declaration = path.parentPath.node as t.ImportDeclaration;
      if (
        path.node.local.name === 'T' &&
        declaration.source.value !== GT_MODULE
      ) {
        foreign = true;
      }
    },
    VariableDeclarator(path) {
      if (t.isIdentifier(path.node.id, { name: 'T' })) foreign = true;
    },
  });
  return foreign;
}

function dedupeSpecifiers(
  specifiers: t.ImportSpecifier[],
  existing: t.ImportDeclaration | undefined
): t.ImportSpecifier[] {
  const seen = new Set<string>(
    (existing?.specifiers ?? [])
      .filter((s): s is t.ImportSpecifier => t.isImportSpecifier(s))
      .map((s) => s.local.name)
  );
  const result: t.ImportSpecifier[] = [];
  for (const specifier of specifiers) {
    if (!seen.has(specifier.local.name)) {
      seen.add(specifier.local.name);
      result.push(specifier);
    }
  }
  return result;
}
