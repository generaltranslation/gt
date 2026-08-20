import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';
import type { Separators } from './catalogConvert.js';

const traverse: typeof traverseModule =
  (traverseModule as { default?: typeof traverseModule }).default ||
  traverseModule;

/**
 * Call-site evidence the catalog converter needs but cannot see from the JSON
 * alone. i18next resolves plurals/context at CALL time (the `{ count }` /
 * `{ context }` option), so suffix keys in the catalog are ambiguous without it:
 * `dish_starter` is `dish`+context only if a call passed `{ context }`, and
 * `item_one`/`item_other` is a plural only if a call passed `{ count }` (or the
 * value contains `{{count}}`). This scan collects that evidence so the converter
 * groups exactly the keys the app actually pluralizes/selects and leaves
 * coincidental suffixed keys literal.
 */
export type CatalogEvidence = {
  /** `{ns}:{keypath}` base keys a `t()` call passed `{ count }`. */
  countKeys: Set<string>;
  /** `{ns}:{keypath}` base keys a `t()` call passed `{ context }`. */
  contextKeys: Set<string>;
  /** literal defaultValues from call sites, to synthesize missing entries. */
  defaults: { ns: string; key: string; value: string }[];
};

type TBinding = { ns: string };

/**
 * Collects call-site evidence across every scanned source file. `defaultNS` and
 * the separators come from the app's i18next init config so namespace/key
 * splitting matches the app.
 */
export function collectCallSiteEvidence(
  sources: { file: string; code: string }[],
  defaultNS: string,
  separators: Separators
): CatalogEvidence {
  const countKeys = new Set<string>();
  const contextKeys = new Set<string>();
  const defaults: { ns: string; key: string; value: string }[] = [];

  for (const { code } of sources) {
    if (!/\buseTranslation\b/.test(code)) continue;
    let ast: t.File;
    try {
      ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });
    } catch {
      continue;
    }

    // useTranslation import locals from react-i18next.
    const useTranslationLocals = new Set<string>();
    traverse(ast, {
      ImportDeclaration(path) {
        const source = path.node.source.value;
        if (
          source !== 'react-i18next' &&
          !source.startsWith('react-i18next/')
        ) {
          return;
        }
        for (const specifier of path.node.specifiers) {
          if (
            t.isImportSpecifier(specifier) &&
            t.isIdentifier(specifier.imported, { name: 'useTranslation' })
          ) {
            useTranslationLocals.add(specifier.local.name);
          }
        }
      },
    });
    if (useTranslationLocals.size === 0) continue;

    // t-local -> its i18next namespace.
    const tBindings = new Map<string, TBinding>();
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
        const ns = nsName ?? defaultNS;
        const id = path.node.id;
        if (t.isObjectPattern(id)) {
          for (const property of id.properties) {
            if (
              t.isObjectProperty(property) &&
              t.isIdentifier(property.key, { name: 't' }) &&
              t.isIdentifier(property.value)
            ) {
              tBindings.set(property.value.name, { ns });
            }
          }
        } else if (t.isArrayPattern(id)) {
          const first = id.elements[0];
          if (t.isIdentifier(first)) tBindings.set(first.name, { ns });
        }
      },
    });
    if (tBindings.size === 0) continue;

    // t() call sites.
    traverse(ast, {
      CallExpression(path) {
        const callee = path.node.callee;
        if (!t.isIdentifier(callee) || !tBindings.has(callee.name)) return;
        const binding = tBindings.get(callee.name)!;
        const keyArg = path.node.arguments[0];
        if (!t.isStringLiteral(keyArg)) return;
        const { ns, key } = splitNs(keyArg.value, binding.ns, separators);
        const evidenceKey = `${ns}:${key}`;

        const secondArg = path.node.arguments[1];
        // Positional string default: t('key', 'Default'[, { count/context }]).
        // Record the default, then keep reading. The 3-arg form still carries
        // its options object in position 2, so a `return` here would drop the
        // count/context evidence (t.isObjectExpression is false for undefined).
        let optionsArg = secondArg;
        if (t.isStringLiteral(secondArg)) {
          defaults.push({ ns, key, value: secondArg.value });
          optionsArg = path.node.arguments[2];
        }
        if (!t.isObjectExpression(optionsArg)) return;
        for (const property of optionsArg.properties) {
          if (t.isObjectProperty(property) && t.isIdentifier(property.key)) {
            if (property.key.name === 'count') countKeys.add(evidenceKey);
            else if (property.key.name === 'context') {
              contextKeys.add(evidenceKey);
            } else if (
              property.key.name === 'defaultValue' &&
              t.isStringLiteral(property.value)
            ) {
              defaults.push({ ns, key, value: property.value.value });
            }
          }
        }
      },
    });
  }

  return { countKeys, contextKeys, defaults };
}

/** Splits a raw `t()` key into its i18next namespace and in-namespace path. */
function splitNs(
  rawKey: string,
  bindingNs: string,
  separators: Separators
): { ns: string; key: string } {
  const nsSep = separators.nsSeparator;
  let ns = bindingNs;
  let key = rawKey;
  if (nsSep && rawKey.includes(nsSep)) {
    const idx = rawKey.indexOf(nsSep);
    ns = rawKey.slice(0, idx);
    key = rawKey.slice(idx + nsSep.length);
  }
  // The converter's keypaths are '.'-joined, so evidence must normalize a custom
  // keySeparator (e.g. '|') to the same convention or nested-key context/plural
  // evidence never matches. keySeparator can be false (flat keys), so leave the
  // key untouched then.
  const keySep = separators.keySeparator;
  if (typeof keySep === 'string' && keySep !== '' && keySep !== '.') {
    key = key.split(keySep).join('.');
  }
  return { ns, key };
}
