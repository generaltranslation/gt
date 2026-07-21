import { parse } from '@babel/parser';
import traverseModule, { type NodePath } from '@babel/traverse';
import generateModule from '@babel/generator';
import * as t from '@babel/types';
import { removeUnusedNamedImports } from './importUtils.js';
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
  /**
   * After removing setRequestLocale, drop a `const { locale } = use(params)` /
   * `= await params` destructure that its removal just orphaned, plus the
   * now-unused `params` parameter and `use` import. Default true. Layouts opt
   * OUT: their step 4 injects `locale={locale}` into a retained
   * NextIntlClientProvider AFTER this pass, reviving a destructure that looks
   * dead here, so they run their own step-7 cleanup instead.
   */
  dropOrphanedParamLocale?: boolean;
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
  const objectArgRewrites: {
    call: t.CallExpression;
    namespace: string | null;
    namespaceExpression: t.Expression | null;
    hadLocale: boolean;
    line?: number;
  }[] = [];
  const providerElements: NodePath<t.JSXElement>[] = [];
  const strippedAttrIdentifiers = new Set<string>();

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
          if (
            first.properties.some((property) => t.isSpreadElement(property))
          ) {
            // A spread ({ ...opts }) may carry namespace or locale options that
            // cannot be read statically; a partial rewrite would silently drop
            // them, so skip the whole file and hold back teardown instead.
            skipReasons.push(
              'getTranslations({ ...spread }) cannot be converted statically, the spread may carry namespace or locale options; convert this call manually'
            );
            return;
          }
          const namespaceProp = getObjectProp(first, 'namespace');
          const namespace =
            namespaceProp && t.isStringLiteral(namespaceProp)
              ? namespaceProp.value
              : null;
          // A non-literal namespace (identifier, member, template, call) can't
          // be resolved to a string here; keep the expression so the apply step
          // passes it through positionally instead of dropping it to root.
          const namespaceExpression =
            namespaceProp && !t.isStringLiteral(namespaceProp)
              ? namespaceProp
              : null;
          const hadLocale = getObjectProp(first, 'locale') !== null;
          objectArgRewrites.push({
            call: init,
            namespace,
            namespaceExpression,
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
          // Converting t.rich to inline <T> would embed the source-language
          // message and stop the key's existing translations from applying
          // until regenerated, so we never do it automatically; the file is
          // left on the working dictionary path for a manual conversion.
          skipReasons.push(
            't.rich(...) conversion would discard existing translations for the key; convert it manually'
          );
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

  const uniqueSkips = [...new Set(skipReasons)];
  if (uniqueSkips.length > 0) {
    return { code: null, todos: [], skipReasons: uniqueSkips };
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

  // 1. setRequestLocale call statements. Record the bare-identifier arguments
  //    (usually `locale`) so the orphaned-destructure cleanup below only touches
  //    a `const { locale } = use(params)` that this removal actually made dead.
  const removedSetRequestLocaleArgs = new Set<string>();
  let setRequestLocaleRemoved = false;
  traverse(ast, {
    ExpressionStatement(path) {
      const expression = unwrapAwait(path.node.expression);
      if (
        expression &&
        t.isCallExpression(expression) &&
        t.isIdentifier(expression.callee) &&
        removalLocals.has(expression.callee.name)
      ) {
        for (const argument of expression.arguments) {
          if (t.isIdentifier(argument)) {
            removedSetRequestLocaleArgs.add(argument.name);
          }
        }
        path.remove();
        setRequestLocaleRemoved = true;
      }
    },
  });

  // 2. getTranslations({ locale, namespace }) -> getTranslations('namespace').
  //    A dynamic namespace becomes the positional argument
  //    getTranslations(expr) so its keys still resolve; a missing namespace
  //    stays getTranslations().
  for (const rewrite of objectArgRewrites) {
    rewrite.call.arguments = rewrite.namespace
      ? [t.stringLiteral(rewrite.namespace)]
      : rewrite.namespaceExpression
        ? [rewrite.namespaceExpression]
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

  // 3. Provider swap + linked messages cleanup.
  const removedProviderMessageBindings = new Set<string>();
  for (const providerPath of providerElements) {
    const opening = providerPath.node.openingElement;
    opening.name = t.jsxIdentifier('GTProvider');
    opening.attributes = [];
    if (providerPath.node.closingElement) {
      providerPath.node.closingElement.name = t.jsxIdentifier('GTProvider');
    }
  }
  let removedGetLocaleBinding = false;
  if (providerElements.length > 0) {
    const getLocaleLocals = localsBy((name) => name === 'getLocale');
    traverse(ast, {
      Program(path) {
        // The attribute strip above removed the JSX references; recrawl so the
        // getLocale binding check below sees true reference counts.
        path.scope.crawl();
      },
      VariableDeclarator(path) {
        if (
          !t.isIdentifier(path.node.id) ||
          !strippedAttrIdentifiers.has(path.node.id.name)
        ) {
          return;
        }
        const init = unwrapAwait(path.node.init);
        if (
          !init ||
          !t.isCallExpression(init) ||
          !t.isIdentifier(init.callee)
        ) {
          return;
        }
        if (messagesHookLocals.has(init.callee.name)) {
          removedProviderMessageBindings.add(init.callee.name);
          path.remove();
          return;
        }
        // `const locale = await getLocale()` that only fed the stripped
        // provider attribute would survive as an unreferenced variable.
        // Messages hooks are provider-only by the skip analysis above;
        // getLocale has no such analysis, so the reference check is the guard
        // (a locale still read elsewhere keeps its declaration).
        if (getLocaleLocals.has(init.callee.name)) {
          const binding = path.scope.getBinding(path.node.id.name);
          if (binding && !binding.referenced) {
            path.remove();
            removedGetLocaleBinding = true;
          }
        }
      },
    });
  }

  // 4. Import surgery.
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

  // 5. Orphaned param-locale cleanup. Runs LAST, after every reference-adding
  //    step, so the recrawl below sees true reference counts. setRequestLocale
  //    removal can strand a `const { locale } = use(params)` (or `= await
  //    params`), which then trips no-unused-vars / TS6133; drop it, the now-dead
  //    `params` parameter, and the `use` import to match how layouts (step 7)
  //    leave their own path lint-clean. Layouts opt out (dropOrphanedParamLocale
  //    false): they revive that destructure by injecting `locale={locale}` into
  //    a retained provider after this pass.
  if (options.dropOrphanedParamLocale !== false && setRequestLocaleRemoved) {
    // Functions whose orphaned params destructure was removed here; each one's
    // `params` parameter may now be unreferenced and need dropping.
    const paramsCleanupTargets = new Set<t.Function>();
    let removedOrphan = false;
    traverse(ast, {
      Program(path) {
        // Recrawl so bindings reflect every mutation above.
        path.scope.crawl();
      },
      VariableDeclaration(path) {
        if (path.node.declarations.length !== 1) return;
        const declarator = path.node.declarations[0];
        if (!t.isObjectPattern(declarator.id)) return;
        if (!isParamsInit(declarator.init)) return;
        // All-or-nothing: keep the declaration unless EVERY name it binds is
        // now unreferenced AND at least one was a removed setRequestLocale
        // argument (so we only clean orphans this codemod created, never the
        // author's own pre-existing dead code).
        let boundToRemovedArg = false;
        for (const property of declarator.id.properties) {
          if (
            !t.isObjectProperty(property) ||
            !t.isIdentifier(property.value)
          ) {
            return;
          }
          if (removedSetRequestLocaleArgs.has(property.value.name)) {
            boundToRemovedArg = true;
          }
          const binding = path.scope.getBinding(property.value.name);
          if (!binding || binding.referenced) return;
        }
        if (!boundToRemovedArg) return;
        const fn = path.getFunctionParent();
        if (fn) paramsCleanupTargets.add(fn.node);
        path.remove();
        removedOrphan = true;
      },
    });

    // Drop the `params` parameter left unreferenced by those removals. A fresh
    // crawl is required so the removed destructure no longer counts as a
    // reference; then each cleaned function's own `params` binding decides.
    // Only that function's params is touched (a sibling generateMetadata keeps
    // its own, separately-scoped binding).
    if (paramsCleanupTargets.size > 0) {
      traverse(ast, {
        Program(path) {
          path.scope.crawl();
        },
        Function(path) {
          if (!paramsCleanupTargets.has(path.node)) return;
          const binding = path.scope.getBinding('params');
          if (!binding || binding.kind !== 'param' || binding.referenced) {
            return;
          }
          removeParamsParameter(path.node);
        },
      });
    }

    // The removed destructure was the last reference to a `use` import; prune
    // it (the helper only drops unreferenced names, so a still-used `use` or a
    // `React.use` namespace stays).
    if (removedOrphan) {
      removeUnusedNamedImports(ast, ['use']);
    }
  }

  // Step 3 may have removed a `const locale = await getLocale()` whose only
  // consumer was a stripped provider attribute; the import surgery above still
  // swapped its getLocale specifier in, so prune it when nothing references it
  // anymore (a second getLocale call site elsewhere keeps the import).
  if (removedGetLocaleBinding) {
    removeUnusedNamedImports(ast, ['getLocale']);
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

/**
 * True when `code` renders a NextIntlClientProvider JSX element imported from
 * next-intl (alias-aware). The migrate driver uses this to DEFER
 * provider-bearing non-layout files: like layouts, their provider-retention
 * decision depends on the final skip set, which is not known during the pass
 * that would otherwise transform them. Cheap-exits before parsing when the
 * provider name is absent from the source text.
 */
export function hasNextIntlProvider(code: string): boolean {
  if (!code.includes(PROVIDER)) return false;
  let ast: t.File;
  try {
    ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
      tokens: true,
      createParenthesizedExpressions: true,
    });
  } catch {
    return false;
  }

  const providerLocals = new Set<string>();
  traverse(ast, {
    ImportDeclaration(path) {
      const source = path.node.source.value;
      if (source !== 'next-intl' && !source.startsWith('next-intl/')) return;
      for (const specifier of path.node.specifiers) {
        if (!t.isImportSpecifier(specifier)) continue;
        const imported = t.isIdentifier(specifier.imported)
          ? specifier.imported.name
          : specifier.imported.value;
        if (imported === PROVIDER) providerLocals.add(specifier.local.name);
      }
    },
  });
  if (providerLocals.size === 0) return false;

  let found = false;
  traverse(ast, {
    JSXOpeningElement(path) {
      const name = path.node.name;
      if (t.isJSXIdentifier(name) && providerLocals.has(name.name)) {
        found = true;
        path.stop();
      }
    },
  });
  return found;
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

/**
 * True when a destructure init reads the route `params`: `params`,
 * `await params`, `use(params)`, or `React.use(params)` (React's `use` unwraps
 * the params promise in a page/segment). Other sources (`props.params`, an
 * arbitrary call) are ignored so only genuine route-param destructures qualify.
 */
function isParamsInit(node: t.Expression | null | undefined): boolean {
  if (!node) return false;
  if (t.isIdentifier(node, { name: 'params' })) return true;
  if (
    t.isAwaitExpression(node) &&
    t.isIdentifier(node.argument, { name: 'params' })
  ) {
    return true;
  }
  if (
    t.isCallExpression(node) &&
    node.arguments.length === 1 &&
    t.isIdentifier(node.arguments[0], { name: 'params' })
  ) {
    const callee = node.callee;
    if (t.isIdentifier(callee, { name: 'use' })) return true;
    if (
      t.isMemberExpression(callee) &&
      !callee.computed &&
      t.isIdentifier(callee.object, { name: 'React' }) &&
      t.isIdentifier(callee.property, { name: 'use' })
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Drop the `params` parameter from a function whose only use of it was an
 * orphaned params destructure the cleanup above just removed. Mirrors
 * transformLayout's step-7 rule exactly: the usual shape is an ObjectPattern
 * parameter (`{ params }`), so remove just the `params` property, which never
 * changes arity. If that would empty the pattern, remove the whole parameter
 * only when it is last (an empty `{}` trips no-empty-pattern, and dropping a
 * non-last positional param shifts the others). A rest sibling would absorb the
 * removed key at runtime (`...rest` gains `params`), so the parameter is left in
 * that shape. TypeScript annotations are left untouched: an unused type member
 * does not lint.
 */
function removeParamsParameter(fn: t.Function): void {
  const params = fn.params;
  for (let index = 0; index < params.length; index++) {
    const param = params[index];
    if (t.isIdentifier(param, { name: 'params' })) {
      if (index === params.length - 1) params.splice(index, 1);
      return;
    }
    if (!t.isObjectPattern(param)) continue;
    const propertyIndex = param.properties.findIndex(
      (property) =>
        t.isObjectProperty(property) &&
        !property.computed &&
        t.isIdentifier(property.value, { name: 'params' })
    );
    if (propertyIndex === -1) continue;
    if (param.properties.some((property) => t.isRestElement(property))) {
      return;
    }
    if (param.properties.length === 1) {
      if (index === params.length - 1) params.splice(index, 1);
      return;
    }
    param.properties.splice(propertyIndex, 1);
    return;
  }
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
