import { parse } from '@babel/parser';
import traverseModule, { type NodePath } from '@babel/traverse';
import generateModule from '@babel/generator';
import * as t from '@babel/types';
import { getI18nextConfig } from '../config/reactI18nextConfig.js';
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

const GT_MODULE = 'gt-next';

/** react-i18next import sources we recognize. */
const RI18N_MODULES = new Set([
  'react-i18next',
  'react-i18next/TransWithoutContext',
]);

/** Named imports from react-i18next we can migrate. Everything else skips. */
const SUPPORTED_RI18N = new Set(['useTranslation', 'Trans', 'I18nextProvider']);

export type ReactI18nextTransformOptions = {
  /** leave <I18nextProvider> untouched so a later pass nests it (partial). */
  retainProvider?: boolean;
};

type TBinding = {
  /** the gt-next useTranslations rootId (null = root/default namespace). */
  rootId: string | null;
  /** the i18next namespace this binding reads (defaultNS when unscoped). */
  i18nextNs: string;
};

/**
 * Migrates the react-i18next CLIENT surface of a file to gt-next:
 * `useTranslation` -> `useTranslations`, `t('ns:key')` remapped to gt's dotted
 * dictionary paths, `i18n.changeLanguage` -> `useSetLocale`, `<I18nextProvider>`
 * -> `<GTProvider>`, and trivial `<Trans i18nKey>` -> a dictionary `t()` call.
 *
 * Anything non-mechanical (a `<Trans>` with element children, `withTranslation`,
 * a bespoke `i18next` server/config import, cross-namespace keys from a scoped
 * hook) leaves the whole file untouched with an actionable skip reason, so the
 * server side and unconvertible client code keep working on react-i18next until
 * the reported edits are made by hand.
 */
export function transformReactI18nextSource(
  file: string,
  code: string,
  ctx: MigrationContext,
  options: ReactI18nextTransformOptions = {}
): SourceResult {
  const none: SourceResult = {
    code: null,
    todos: [],
    skipReasons: [],
  };
  if (!/['"](?:react-)?i18next(?:\/[^'"]*)?['"]/.test(code)) return none;

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

  const config = getI18nextConfig(ctx.cwd);
  const skipReasons: string[] = [];
  const todos: TodoEntry[] = [];

  // ---- collect imports -----------------------------------------------------
  const useTranslationLocals = new Set<string>();
  const transLocals = new Set<string>();
  const providerLocals = new Set<string>();
  const ri18nImportPaths: NodePath<t.ImportDeclaration>[] = [];

  traverse(ast, {
    ImportDeclaration(path) {
      const source = path.node.source.value;
      if (source === 'i18next' || source.startsWith('i18next/')) {
        skipReasons.push(
          `imports from 'i18next' directly (bespoke setup); gt migrate does not rewrite hand-rolled i18next server/config code; migrate it manually to gt-next/server (getTranslations) and gt-next/config`
        );
        return;
      }
      if (!RI18N_MODULES.has(source)) return;
      // Type-only imports are erased at build time, and this adapter never
      // uninstalls react-i18next (teardownPackages: []), so a `type` import is
      // harmless and needs no migration (the N2 nit). A whole
      // `import type { … } from 'react-i18next'` declaration, or an import whose
      // specifiers are all inline `type` (`import { type TFunction }`), is left
      // untouched and never reported as an unsupported API; so a file whose only
      // react-i18next surface is type-only imports passes straight through. Only
      // value specifiers drive the transform; a residual inline `type` specifier
      // on an otherwise-migrated declaration is preserved by applyImportSurgery.
      if (path.node.importKind === 'type') return;
      const valueSpecifiers = path.node.specifiers.filter(
        (specifier) =>
          !(t.isImportSpecifier(specifier) && specifier.importKind === 'type')
      );
      if (valueSpecifiers.length === 0) return;
      ri18nImportPaths.push(path);
      for (const specifier of valueSpecifiers) {
        if (!t.isImportSpecifier(specifier)) {
          skipReasons.push(
            `unsupported react-i18next import form from '${source}'`
          );
          continue;
        }
        const imported = t.isIdentifier(specifier.imported)
          ? specifier.imported.name
          : specifier.imported.value;
        if (!SUPPORTED_RI18N.has(imported)) {
          skipReasons.push(
            `unsupported react-i18next API: ${imported} (from '${source}'); convert manually (see the gt-next docs)`
          );
          continue;
        }
        if (imported === 'useTranslation')
          useTranslationLocals.add(specifier.local.name);
        else if (imported === 'Trans') transLocals.add(specifier.local.name);
        else if (imported === 'I18nextProvider')
          providerLocals.add(specifier.local.name);
      }
    },
  });

  if (ri18nImportPaths.length === 0 && skipReasons.length === 0) return none;
  if (skipReasons.length > 0) {
    return {
      code: null,
      todos: [],
      skipReasons: [...new Set(skipReasons)],
    };
  }

  // ---- analysis pass -------------------------------------------------------
  const tBindings = new Map<string, TBinding>();
  const i18nBindings = new Map<
    string,
    { onlyChangeLanguage: boolean; local: string; referenced: boolean }
  >();
  let needsUseTranslations = false;
  let needsSetLocale = false;
  let needsGtProvider = false;

  // First, resolve every useTranslation() call binding.
  traverse(ast, {
    VariableDeclarator(path) {
      const init = path.node.init;
      if (
        !init ||
        !t.isCallExpression(init) ||
        !t.isIdentifier(init.callee) ||
        !useTranslationLocals.has(init.callee.name)
      ) {
        return;
      }
      const nsArg = init.arguments[0];
      // Multi-element array namespaces (`useTranslation(['a','b'])`) bind the
      // first as default and use the rest as i18next fallback resolution for
      // keys missing from it. gt-next scoped hooks resolve only within a single
      // namespace, so collapsing to element[0] would silently turn a fallback
      // hit into a missing key, so skip+report instead (the M1 finding). A
      // single-element array is unambiguous and still converts.
      if (
        t.isArrayExpression(nsArg) &&
        nsArg.elements.filter((element) => element != null).length > 1
      ) {
        skipReasons.push(
          'useTranslation([...]) with multiple namespaces uses i18next fallback resolution that gt-next scoped hooks do not replicate; split the call or use a root useTranslations()'
        );
        return;
      }
      const nsName = t.isStringLiteral(nsArg)
        ? nsArg.value
        : t.isArrayExpression(nsArg) && t.isStringLiteral(nsArg.elements[0])
          ? (nsArg.elements[0] as t.StringLiteral).value
          : null;
      // A namespace passed as anything but a string literal (an identifier, a
      // prop, a call) resolves at runtime; treating it as the default
      // namespace would compile cleanly and then resolve every t() on this
      // binding against the wrong dictionary scope, with no error to catch
      // it. Skip+report instead. A missing argument stays on the default
      // namespace, which is i18next's own behavior.
      if (nsArg != null && nsName === null) {
        skipReasons.push(
          'useTranslation() namespace is not a string literal, so its keys cannot be remapped to the converted dictionary; convert this file manually'
        );
        return;
      }
      const i18nextNs = nsName ?? config.defaultNS;
      const rootId = i18nextNs === config.defaultNS ? null : i18nextNs;

      const id = path.node.id;
      if (t.isObjectPattern(id)) {
        for (const property of id.properties) {
          if (
            !t.isObjectProperty(property) ||
            property.computed ||
            !t.isIdentifier(property.key)
          ) {
            skipReasons.push(
              'useTranslation() is destructured in a shape gt migrate does not recognize; convert manually'
            );
            continue;
          }
          const keyName = property.key.name;
          const localName = t.isIdentifier(property.value)
            ? property.value.name
            : null;
          if (!localName) {
            skipReasons.push(
              'useTranslation() destructure value is not a plain identifier; convert manually'
            );
            continue;
          }
          if (keyName === 't') {
            tBindings.set(localName, { rootId, i18nextNs });
          } else if (keyName === 'i18n') {
            i18nBindings.set(localName, {
              onlyChangeLanguage: true,
              local: localName,
              referenced: false,
            });
          } else if (keyName === 'ready') {
            // ready flag has no gt equivalent (gt suspends/streams instead).
            skipReasons.push(
              "useTranslation()'s `ready` flag has no gt-next equivalent (gt handles loading via streaming); remove it manually"
            );
          } else {
            skipReasons.push(
              `useTranslation() destructures \`${keyName}\`, which gt migrate does not support; convert manually`
            );
          }
        }
      } else if (t.isArrayPattern(id)) {
        const [tEl, i18nEl] = id.elements;
        if (t.isIdentifier(tEl)) tBindings.set(tEl.name, { rootId, i18nextNs });
        if (t.isIdentifier(i18nEl))
          i18nBindings.set(i18nEl.name, {
            onlyChangeLanguage: true,
            local: i18nEl.name,
            referenced: false,
          });
      } else {
        skipReasons.push(
          'useTranslation() is assigned to a non-destructured binding; convert manually'
        );
      }
    },
  });

  // Inspect i18n usages: only a `i18n.changeLanguage(...)` CALL is supported. A
  // bare `i18n.changeLanguage` reference (`const f = i18n.changeLanguage`,
  // `onChange={i18n.changeLanguage}`) is NOT. After migration `i18n` is the
  // useSetLocale() function, so `i18n.changeLanguage` is undefined and the file
  // miscompiles (the M2 finding). Treat member access as supported only when it
  // is the callee of a call expression.
  if (i18nBindings.size > 0) {
    traverse(ast, {
      Identifier(path) {
        const binding = i18nBindings.get(path.node.name);
        if (!binding || !path.isReferencedIdentifier()) return;
        // Reference inside its own destructure declarator: ignore.
        if (isOwnDeclarator(path)) return;
        binding.referenced = true;
        const parent = path.parent;
        // `i18n.changeLanguage(...)`: member access on i18n, property
        // `changeLanguage`, and that member is the callee of a call.
        if (
          t.isMemberExpression(parent) &&
          parent.object === path.node &&
          !parent.computed &&
          t.isIdentifier(parent.property, { name: 'changeLanguage' })
        ) {
          const callParent = path.parentPath?.parent;
          if (t.isCallExpression(callParent) && callParent.callee === parent) {
            return; // supported: an actual changeLanguage() call
          }
        }
        // Anything else (a bare changeLanguage reference, i18n.language, …)
        // disqualifies the file.
        binding.onlyChangeLanguage = false;
      },
    });
    for (const binding of i18nBindings.values()) {
      if (!binding.onlyChangeLanguage) {
        skipReasons.push(
          `the i18n instance from useTranslation() is used beyond changeLanguage() calls; only locale switching maps to gt-next (useSetLocale). A bare i18n.changeLanguage reference (not a call) or other i18n.* usage must be converted manually`
        );
      }
    }
  }

  // Inspect t usages the same way: only direct `t(...)` calls (plus a `t={t}`
  // prop on a <Trans>, which the Trans conversion consumes) are supported. A
  // `t` that escapes as a value — passed to a helper (typically typed against
  // i18next's branded TFunction), stored, returned, or read as a member —
  // keeps i18next's signature and type expectations at its consumer, which
  // gt-next's translation function does not satisfy; rewriting the binding
  // anyway is what broke the round-7 PlantPal build and produced Memo
  // Engine's 134 translateKnown(t, ...) type errors. Whole-file skip instead.
  if (tBindings.size > 0) {
    const escapedTs = new Set<string>();
    traverse(ast, {
      Identifier(path) {
        if (!tBindings.has(path.node.name) || !path.isReferencedIdentifier()) {
          return;
        }
        if (isOwnDeclarator(path)) return;
        const parent = path.parent;
        if (t.isCallExpression(parent) && parent.callee === path.node) {
          return; // a direct t(...) call, remapped below
        }
        if (
          t.isJSXExpressionContainer(parent) &&
          parent.expression === path.node
        ) {
          const attr = path.parentPath?.parent;
          const element = path.parentPath?.parentPath?.parent;
          if (
            t.isJSXAttribute(attr) &&
            t.isJSXIdentifier(attr.name, { name: 't' }) &&
            t.isJSXOpeningElement(element) &&
            t.isJSXIdentifier(element.name) &&
            transLocals.has(element.name.name)
          ) {
            return; // <Trans t={t}>: consumed by the Trans conversion
          }
        }
        escapedTs.add(path.node.name);
      },
    });
    for (const name of escapedTs) {
      skipReasons.push(
        `the translation function '${name}' from useTranslation() is used as a value beyond direct ${name}(...) calls (passed to a helper, stored, or returned); consumers typed against i18next's TFunction will not accept gt-next's translation function, so this file stays on react-i18next; convert it together with that helper manually`
      );
    }
  }

  // Detect Trans elements and classify.
  const transConversions: {
    path: NodePath<t.JSXElement>;
    call: t.CallExpression;
  }[] = [];
  if (transLocals.size > 0) {
    traverse(ast, {
      JSXElement(path) {
        const name = path.node.openingElement.name;
        if (!t.isJSXIdentifier(name) || !transLocals.has(name.name)) return;
        const outcome = analyzeTrans(path, tBindings, config, ctx);
        if (typeof outcome === 'string') {
          skipReasons.push(outcome);
        } else {
          transConversions.push({ path, call: outcome });
        }
      },
    });
  }

  // Cross-namespace keys from a scoped hook: `useTranslation('dashboard')` then
  // `t('common:brand')` is valid i18next but has no gt-next equivalent (a scoped
  // useTranslations('dashboard') resolves only within that namespace). mapKey
  // returns null for exactly this case; surface it as a skip rather than emit a
  // call that would throw on an unknown key at runtime.
  traverse(ast, {
    CallExpression(path) {
      const callee = path.node.callee;
      if (!t.isIdentifier(callee) || !tBindings.has(callee.name)) return;
      const binding = tBindings.get(callee.name)!;
      if (binding.rootId === null) return; // root hook reaches every namespace
      const keyArg = path.node.arguments[0];
      const keys = t.isStringLiteral(keyArg)
        ? [keyArg.value]
        : t.isArrayExpression(keyArg)
          ? keyArg.elements
              .filter((e): e is t.StringLiteral => t.isStringLiteral(e))
              .map((e) => e.value)
          : [];
      for (const key of keys) {
        if (mapKey(key, binding, config) === null) {
          skipReasons.push(
            `a scoped useTranslation('${binding.i18nextNs}') call reads another namespace via '${key}'; gt-next scoped hooks resolve only within their namespace; use a root useTranslations() or split the call`
          );
        }
      }
    },
  });

  // Provider elements: the swap drops every attribute, which is safe only for
  // the canonical `<I18nextProvider i18n={i18n}>`. A spread or any prop besides
  // `i18n` would be silently lost, so skip+report the file instead (the m3
  // finding). Detected here so it contributes to the skip gate.
  if (providerLocals.size > 0) {
    traverse(ast, {
      JSXOpeningElement(path) {
        const name = path.node.name;
        if (!t.isJSXIdentifier(name) || !providerLocals.has(name.name)) return;
        for (const attr of path.node.attributes) {
          if (t.isJSXSpreadAttribute(attr)) {
            skipReasons.push(
              `<${name.name}> uses a spread attribute; the provider swap to <GTProvider> would drop it, so remove the spread or migrate the provider manually`
            );
            continue;
          }
          if (
            t.isJSXAttribute(attr) &&
            t.isJSXIdentifier(attr.name) &&
            attr.name.name !== 'i18n'
          ) {
            skipReasons.push(
              `<${name.name}> has a \`${attr.name.name}\` prop besides i18n; the provider swap to <GTProvider> would drop it, so migrate the provider manually`
            );
          }
        }
      },
    });
  }

  // B3 (greptile round): a t() key fallback array with any non-literal element
  // cannot be remapped. The winning key is unknowable at build time, and
  // gt-next's t() takes a single string key, so leaving the array call in the
  // output would emit code that breaks at the call site. All-literal arrays
  // are resolved to their winning key by the mutation pass instead.
  traverse(ast, {
    CallExpression(path) {
      const callee = path.node.callee;
      if (!t.isIdentifier(callee) || !tBindings.has(callee.name)) return;
      const keyArg = path.node.arguments[0];
      if (
        t.isArrayExpression(keyArg) &&
        keyArg.elements.some((element) => !t.isStringLiteral(element))
      ) {
        skipReasons.push(
          't() is called with a key fallback array containing a dynamic element; the winning key cannot be resolved at build time and gt-next t() takes a single string key, so convert this file manually'
        );
      }
    },
  });

  // B2: every reference to a react-i18next import local must be consumed by a
  // recognized conversion. A surviving reference (a thin wrapper hook
  // `return useTranslation(ns)`, a mixed file, a `const T = Trans`) would be
  // orphaned once the import is stripped, compiling to an undefined symbol. A
  // useTranslation local is consumed only as the callee of a call that inits a
  // destructured declarator (what the mutation pass rewrites); <Trans> /
  // <I18nextProvider> JSX use is a JSXIdentifier (not matched here) and handled
  // by their own passes, so only value-position references trip this.
  traverse(ast, {
    Identifier(path) {
      const name = path.node.name;
      if (
        !useTranslationLocals.has(name) &&
        !transLocals.has(name) &&
        !providerLocals.has(name)
      ) {
        return;
      }
      if (!path.isReferencedIdentifier()) return;
      const parent = path.parent;
      if (t.isCallExpression(parent) && parent.callee === path.node) {
        const declarator = path.parentPath?.parent;
        if (
          t.isVariableDeclarator(declarator) &&
          declarator.init === parent &&
          (t.isObjectPattern(declarator.id) || t.isArrayPattern(declarator.id))
        ) {
          return; // consumed: const { t, i18n } = useTranslation(...)
        }
      }
      skipReasons.push(
        `this file re-exports or wraps react-i18next's ${name} (e.g. a custom hook or a re-assignment); gt migrate cannot rewrite the wrapper, so point the wrapper's consumers at the gt-next equivalents (useTranslations/useSetLocale/<T>) manually`
      );
    },
  });

  const uniqueSkips = [...new Set(skipReasons)];
  if (uniqueSkips.length > 0) {
    return { code: null, todos: [], skipReasons: uniqueSkips };
  }

  // ---- mutation pass -------------------------------------------------------

  // 1. Rewrite useTranslation() variable declarators.
  traverse(ast, {
    VariableDeclarator(path) {
      const init = path.node.init;
      if (
        !init ||
        !t.isCallExpression(init) ||
        !t.isIdentifier(init.callee) ||
        !useTranslationLocals.has(init.callee.name)
      ) {
        return;
      }
      const nsArg = init.arguments[0];
      const nsName = t.isStringLiteral(nsArg)
        ? nsArg.value
        : t.isArrayExpression(nsArg) && t.isStringLiteral(nsArg.elements[0])
          ? (nsArg.elements[0] as t.StringLiteral).value
          : null;
      const i18nextNs = nsName ?? config.defaultNS;
      const rootId = i18nextNs === config.defaultNS ? null : i18nextNs;

      const id = path.node.id;
      let tLocal: string | null = null;
      let i18nLocal: string | null = null;
      if (t.isObjectPattern(id)) {
        for (const property of id.properties) {
          if (
            t.isObjectProperty(property) &&
            t.isIdentifier(property.key) &&
            t.isIdentifier(property.value)
          ) {
            if (property.key.name === 't') tLocal = property.value.name;
            else if (property.key.name === 'i18n')
              i18nLocal = property.value.name;
          }
        }
      } else if (t.isArrayPattern(id)) {
        const [tEl, i18nEl] = id.elements;
        if (t.isIdentifier(tEl)) tLocal = tEl.name;
        if (t.isIdentifier(i18nEl)) i18nLocal = i18nEl.name;
      }

      const replacements: t.VariableDeclarator[] = [];
      if (tLocal) {
        needsUseTranslations = true;
        replacements.push(
          t.variableDeclarator(
            t.identifier(tLocal),
            t.callExpression(
              t.identifier('useTranslations'),
              rootId ? [t.stringLiteral(rootId)] : []
            )
          )
        );
      }
      // Drop an unreferenced i18n binding rather than emitting a dead
      // `const i18n = useSetLocale()` + import (the m3 finding), but only when
      // a t binding remains, so an i18n-only hook still produces a declarator
      // (dropping it would strip the import and orphan the call).
      const i18nReferenced = i18nLocal
        ? (i18nBindings.get(i18nLocal)?.referenced ?? false)
        : false;
      if (i18nLocal && (i18nReferenced || !tLocal)) {
        needsSetLocale = true;
        replacements.push(
          t.variableDeclarator(
            t.identifier(i18nLocal),
            t.callExpression(t.identifier('useSetLocale'), [])
          )
        );
      }
      if (replacements.length === 1) {
        path.node.id = replacements[0].id;
        path.node.init = replacements[0].init;
      } else if (replacements.length > 1) {
        const declaration = path.parentPath;
        if (declaration.isVariableDeclaration()) {
          declaration.node.declarations = replacements;
        }
      }
    },
  });

  // 2. `i18n.changeLanguage(x)` -> `setLocale(x)` (setLocale reuses the i18n
  //    local name, now bound to useSetLocale()).
  if (needsSetLocale) {
    traverse(ast, {
      CallExpression(path) {
        const callee = path.node.callee;
        if (
          t.isMemberExpression(callee) &&
          !callee.computed &&
          t.isIdentifier(callee.object) &&
          i18nBindings.has(callee.object.name) &&
          t.isIdentifier(callee.property, { name: 'changeLanguage' })
        ) {
          path.node.callee = t.identifier(callee.object.name);
        }
      },
    });
  }

  // 3. Remap / normalize t() calls (ns:key, fallback arrays, string defaults).
  remapTCalls(ast, tBindings, config, ctx, todos, file);

  // 4. Provider swap: <I18nextProvider> -> <GTProvider> (unless retained).
  if (providerLocals.size > 0 && !options.retainProvider) {
    traverse(ast, {
      JSXElement(path) {
        const opening = path.node.openingElement;
        if (
          !t.isJSXIdentifier(opening.name) ||
          !providerLocals.has(opening.name.name)
        ) {
          return;
        }
        opening.name = t.jsxIdentifier('GTProvider');
        opening.attributes = [];
        if (path.node.closingElement) {
          path.node.closingElement.name = t.jsxIdentifier('GTProvider');
        }
        needsGtProvider = true;
      },
    });
  }

  // 5. Trans -> t(...) conversions. A JSXExpressionContainer is a legal node
  //    ONLY as a JSX child or attribute value; a standalone <Trans> (a return
  //    argument, variable init, ternary arm, arrow body, array element) must be
  //    replaced with the plain call expression or @babel/types throws and takes
  //    down the whole migrate run (the B1 finding). Pick by parent position.
  for (const { path, call } of transConversions) {
    const parent = path.parent;
    const inJsxChild = t.isJSXElement(parent) || t.isJSXFragment(parent);
    path.replaceWith(inJsxChild ? t.jsxExpressionContainer(call) : call);
  }

  // 6. Import surgery: drop react-i18next imports, add the gt-next import.
  const gtSpecifiers: t.ImportSpecifier[] = [];
  if (needsUseTranslations) gtSpecifiers.push(named('useTranslations'));
  if (needsSetLocale) gtSpecifiers.push(named('useSetLocale'));
  if (needsGtProvider && options.retainProvider !== true)
    gtSpecifiers.push(named('GTProvider'));

  applyImportSurgery(
    ast,
    ri18nImportPaths,
    gtSpecifiers,
    options.retainProvider === true
  );

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
  return { code: output.code, todos, skipReasons: [] };
}

// ---- t() call remapping ----------------------------------------------------

function remapTCalls(
  ast: t.File,
  tBindings: Map<string, TBinding>,
  config: ReturnType<typeof getI18nextConfig>,
  ctx: MigrationContext,
  todos: TodoEntry[],
  file: string
): void {
  const catalog = ctx.catalogs.byLocale[ctx.catalogs.defaultLocale] ?? {};
  traverse(ast, {
    CallExpression(path) {
      const callee = path.node.callee;
      if (!t.isIdentifier(callee) || !tBindings.has(callee.name)) return;
      const binding = tBindings.get(callee.name)!;
      const [keyArg, secondArg] = path.node.arguments;

      // Key fallback arrays: t(['a', 'b.c']) -> the first key present in the
      // (converted) catalog.
      if (t.isArrayExpression(keyArg)) {
        const keys = keyArg.elements.filter((e): e is t.StringLiteral =>
          t.isStringLiteral(e)
        );
        // Arrays with a dynamic element never reach this pass: the B3 analysis
        // scan skips the whole file (unreachable guard kept as defense).
        if (keys.length !== keyArg.elements.length) return;
        const winner = keys.find((k) =>
          keyPresent(catalog, binding, k.value, config)
        );
        const chosen = winner ?? keys[0];
        if (chosen) {
          const mapped = mapKey(chosen.value, binding, config);
          if (mapped === null) return;
          keyArg && (path.node.arguments[0] = t.stringLiteral(mapped));
          todos.push({
            file,
            line: path.node.loc?.start.line,
            reason: `key fallback array resolved to '${chosen.value}' at build time; verify that is the intended key`,
          });
        }
        return;
      }

      if (!t.isStringLiteral(keyArg)) {
        // Dynamic key (template literal, variable): cannot be remapped. Because
        // the converter re-nests namespaces (defaultNS at root, others nested),
        // the runtime key space can differ from i18next's, so a computed key can
        // silently stop resolving, so flag it (the m1 finding).
        if (keyArg) {
          todos.push({
            file,
            line: path.node.loc?.start.line,
            reason:
              'dynamic translation key left unchanged; verify it resolves against the converted dictionary (namespaces are re-nested, so the runtime key space may differ from i18next)',
          });
        }
        return;
      }

      const mapped = mapKey(keyArg.value, binding, config);
      if (mapped !== null && mapped !== keyArg.value) {
        path.node.arguments[0] = t.stringLiteral(mapped);
      }

      // String defaultValue: t('k', 'Default') -> t('k') (catalog wins; a
      // synthesized entry covers a missing key). Drop the positional default but
      // preserve any trailing options: i18next's 3-arg form is
      // t(key, defaultValue, options) and gt-next's is t(key, options), so
      // dropping only position 1 keeps { count }/{ context } at runtime.
      if (t.isStringLiteral(secondArg)) {
        path.node.arguments = [
          path.node.arguments[0],
          ...path.node.arguments.slice(2),
        ];
        todos.push({
          file,
          line: path.node.loc?.start.line,
          reason: `dropped the inline defaultValue for '${keyArg.value}'; the migrated catalog entry is authoritative`,
        });
      }
    },
  });
}

/** Maps an i18next call key to gt's dotted dictionary path for this binding. */
function mapKey(
  rawKey: string,
  binding: TBinding,
  config: ReturnType<typeof getI18nextConfig>
): string | null {
  const nsSep = config.separators.nsSeparator;
  let callNs = binding.i18nextNs;
  let keyPath = rawKey;
  if (nsSep && rawKey.includes(nsSep)) {
    const idx = rawKey.indexOf(nsSep);
    callNs = rawKey.slice(0, idx);
    keyPath = rawKey.slice(idx + nsSep.length);
  }

  // Re-express the key on gt-next's '.' path separator. i18next may use a custom
  // keySeparator (e.g. '|'); the converted dictionary nests exactly the way
  // gt-next resolves it (by '.'), so the emitted key must use '.' too or every
  // runtime lookup misses. keySeparator: false is refused during catalog
  // discovery, and a segment containing a literal '.' refuses there too, so a
  // run reaching here has a string separator whose split maps cleanly onto '.'.
  const keySep = config.separators.keySeparator;
  if (typeof keySep === 'string' && keySep !== '' && keySep !== '.') {
    keyPath = keyPath.split(keySep).join('.');
  }

  if (binding.rootId === null) {
    // Root-scoped gt hook: the key is the full path from the dictionary root.
    return callNs === config.defaultNS ? keyPath : `${callNs}.${keyPath}`;
  }
  // Scoped gt hook (useTranslations('ns')): key is relative to that namespace.
  if (callNs === binding.i18nextNs) return keyPath;
  // A cross-namespace key from a scoped hook cannot be expressed; signal by
  // returning null so the caller leaves it (the file was already skipped if
  // this mattered; this is a defensive no-op).
  return null;
}

function keyPresent(
  catalog: Record<string, unknown>,
  binding: TBinding,
  rawKey: string,
  config: ReturnType<typeof getI18nextConfig>
): boolean {
  const mapped = mapKey(rawKey, binding, config);
  if (mapped === null) return false;
  const prefix = binding.rootId ? `${binding.rootId}.` : '';
  return getByDottedPath(catalog, prefix + mapped) !== undefined;
}

function getByDottedPath(
  tree: Record<string, unknown>,
  dotted: string
): unknown {
  let current: unknown = tree;
  for (const seg of dotted.split('.')) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
}

// ---- <Trans> analysis ------------------------------------------------------

/**
 * Classifies a <Trans> element. Returns a ready `t(...)` call for a trivial
 * one (i18nKey with no element children / components), or a skip-reason string
 * for a non-trivial one (element children, missing key, no t in scope).
 */
function analyzeTrans(
  path: NodePath<t.JSXElement>,
  tBindings: Map<string, TBinding>,
  config: ReturnType<typeof getI18nextConfig>,
  ctx: MigrationContext
): t.CallExpression | string {
  const actionable =
    'a <Trans> with element children is not mechanically convertible; rewrite it with the gt-next <T> component (its children are translated in place)';
  const opening = path.node.openingElement;

  let i18nKey: string | null = null;
  let ns: string | null = null;
  let values: t.Expression | null = null;
  let count: t.Expression | null = null;
  let tAttr: string | null = null;
  let hasComponents = false;

  for (const attr of opening.attributes) {
    if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name)) {
      return actionable;
    }
    const attrName = attr.name.name;
    const value = attr.value;
    if (attrName === 'i18nKey' && t.isStringLiteral(value))
      i18nKey = value.value;
    else if (attrName === 'ns' && t.isStringLiteral(value)) ns = value.value;
    else if (
      attrName === 'values' &&
      t.isJSXExpressionContainer(value) &&
      t.isExpression(value.expression)
    ) {
      values = value.expression;
    } else if (
      attrName === 'count' &&
      t.isJSXExpressionContainer(value) &&
      t.isExpression(value.expression)
    ) {
      count = value.expression;
    } else if (
      attrName === 't' &&
      t.isJSXExpressionContainer(value) &&
      t.isIdentifier(value.expression)
    ) {
      tAttr = value.expression.name;
    } else if (attrName === 'components') {
      hasComponents = true;
    } else if (attrName === 'i18nKey' || attrName === 'ns') {
      return actionable; // dynamic key/ns
    }
    // other attrs (tOptions, shouldUnescape, parent); ignore benign ones
  }

  if (hasComponents) return actionable;
  // Element children => non-trivial.
  for (const child of path.node.children) {
    if (t.isJSXElement(child) || t.isJSXFragment(child)) return actionable;
  }
  if (!i18nKey) {
    return 'a <Trans> without a static i18nKey cannot be converted automatically; give it an i18nKey or use the gt-next <T> component';
  }

  // Choose a t binding: an explicit t={...} attr, else the sole binding.
  let binding: TBinding | undefined;
  let tName: string | undefined;
  if (tAttr && tBindings.has(tAttr)) {
    tName = tAttr;
    binding = tBindings.get(tAttr);
  } else if (tBindings.size === 1) {
    tName = [...tBindings.keys()][0];
    binding = [...tBindings.values()][0];
  }
  if (!binding || !tName) {
    return 'a <Trans> has no translation function in scope to convert to a dictionary call; use the gt-next <T> component instead';
  }

  const rawKey =
    ns && config.separators.nsSeparator
      ? `${ns}${config.separators.nsSeparator}${i18nKey}`
      : i18nKey;
  const mapped = mapKey(rawKey, binding, config);
  if (mapped === null) {
    return `a <Trans i18nKey="${i18nKey}"> references a namespace outside its scoped hook; convert manually or use <T>`;
  }

  const args: t.Expression[] = [t.stringLiteral(mapped)];
  const optionProps: t.ObjectProperty[] = [];
  if (count) optionProps.push(t.objectProperty(t.identifier('count'), count));
  if (values && t.isObjectExpression(values))
    optionProps.push(
      ...values.properties.filter((p): p is t.ObjectProperty =>
        t.isObjectProperty(p)
      )
    );
  else if (values) {
    // a spread/identifier values object: pass it as-is via spread.
    optionProps.length = 0;
    return trivialCall(tName, mapped, values, count);
  }
  if (optionProps.length > 0) args.push(t.objectExpression(optionProps));
  return t.callExpression(t.identifier(tName), args);
}

function trivialCall(
  tName: string,
  key: string,
  values: t.Expression,
  count: t.Expression | null
): t.CallExpression {
  const properties: (t.ObjectProperty | t.SpreadElement)[] = [
    t.spreadElement(values),
  ];
  if (count) properties.unshift(t.objectProperty(t.identifier('count'), count));
  return t.callExpression(t.identifier(tName), [
    t.stringLiteral(key),
    t.objectExpression(properties),
  ]);
}

// ---- import surgery --------------------------------------------------------

function applyImportSurgery(
  ast: t.File,
  ri18nImportPaths: NodePath<t.ImportDeclaration>[],
  gtSpecifiers: t.ImportSpecifier[],
  retainProvider: boolean
): void {
  // Find an existing gt-next import to merge into.
  let mergeTarget: t.ImportDeclaration | null = null;
  traverse(ast, {
    ImportDeclaration(path) {
      if (path.node.source.value === GT_MODULE && !mergeTarget) {
        mergeTarget = path.node;
      }
    },
  });

  const unique = dedupe(gtSpecifiers, mergeTarget);
  const newDeclaration =
    unique.length > 0
      ? t.importDeclaration(unique, t.stringLiteral(GT_MODULE))
      : null;

  if (mergeTarget && unique.length > 0) {
    (mergeTarget as t.ImportDeclaration).specifiers.push(...unique);
  }

  let insertedNew = false;
  for (const importPath of ri18nImportPaths) {
    // Build-erased inline `type` specifiers must survive the surgery: this
    // adapter never uninstalls react-i18next, so a `import { …, type TFunction }`
    // whose type is referenced elsewhere must not be left dangling (the N2 nit).
    const typeSpecifiers = importPath.node.specifiers.filter(
      (s): s is t.ImportSpecifier =>
        t.isImportSpecifier(s) && s.importKind === 'type'
    );

    // When retaining the provider, keep the I18nextProvider specifier and its
    // module (plus any `type` specifiers); drop only the migrated hook/Trans
    // specifiers.
    if (retainProvider) {
      const kept = importPath.node.specifiers.filter(
        (s) =>
          (t.isImportSpecifier(s) &&
            t.isIdentifier(s.imported) &&
            s.imported.name === 'I18nextProvider') ||
          (t.isImportSpecifier(s) && s.importKind === 'type')
      );
      if (kept.length > 0) {
        importPath.node.specifiers = kept;
        // The retained react-i18next declaration (e.g. a combined
        // `{ useTranslation, I18nextProvider }`) still had its hook migrated to
        // useTranslations(), so the gt-next import must land even though this
        // declaration survives. Insert it after the retained import when nothing
        // else has (mirrors the type-only branch below) so the migrated hook is
        // never left without its import.
        if (!mergeTarget && !insertedNew && newDeclaration) {
          importPath.insertAfter(newDeclaration);
          insertedNew = true;
        }
        continue;
      }
    }

    // Reduce a migrated declaration that still carries `type` specifiers to a
    // (build-erased) type-only import rather than removing it, and still add the
    // gt-next import.
    if (typeSpecifiers.length > 0) {
      importPath.node.specifiers = typeSpecifiers;
      if (!mergeTarget && !insertedNew && newDeclaration) {
        importPath.insertAfter(newDeclaration);
        insertedNew = true;
      }
      continue;
    }

    if (!mergeTarget && !insertedNew && newDeclaration) {
      importPath.replaceWith(newDeclaration);
      insertedNew = true;
    } else {
      importPath.remove();
    }
  }
}

function dedupe(
  specifiers: t.ImportSpecifier[],
  existing: t.ImportDeclaration | null
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

function named(name: string): t.ImportSpecifier {
  return t.importSpecifier(t.identifier(name), t.identifier(name));
}

function isOwnDeclarator(path: NodePath<t.Identifier>): boolean {
  const declarator = path.findParent((p) => p.isVariableDeclarator());
  if (!declarator || !declarator.isVariableDeclarator()) return false;
  const id = declarator.node.id;
  return (
    (t.isObjectPattern(id) || t.isArrayPattern(id)) &&
    !!path.findParent((p) => p.node === id)
  );
}
