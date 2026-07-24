import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';
import type { RoutingInfo } from '../pipeline/types.js';

const traverse: typeof traverseModule =
  (traverseModule as { default?: typeof traverseModule }).default ||
  traverseModule;

const ROUTING_CANDIDATES = [
  'i18n/routing.ts',
  'i18n/routing.js',
  'src/i18n/routing.ts',
  'src/i18n/routing.js',
  'i18n.ts',
  'src/i18n.ts',
];

const REQUEST_CANDIDATES = [
  'i18n/request.ts',
  'i18n/request.js',
  'src/i18n/request.ts',
  'src/i18n/request.js',
];

/**
 * Extracts locales/defaultLocale/localePrefix/pathnames from the project's
 * next-intl routing config. Only static literals are resolved; anything
 * dynamic yields null for that field so callers can record a TODO instead
 * of guessing. When localePrefix or pathnames is present but not statically
 * resolvable (a variable reference, a computed value), the matching
 * *Unresolved flag is set so callers can tell "not configured" apart from
 * "configured but unreadable" and never mistake the null for next-intl's
 * default.
 *
 * A spread ({ ...base }, or even an inline object literal, since getProperty
 * never reads inside one) may carry localePrefix or pathnames, or override a
 * value set before it. When any spread is present, either field is reported
 * UNRESOLVED (not absent) unless a property resolves it AFTER the spread, so the
 * transforms skip and leave a TODO rather than assume next-intl's 'always'
 * default or silently drop localized pathnames.
 */
export function parseRoutingConfig(cwd: string): RoutingInfo {
  const info: RoutingInfo = {
    locales: null,
    defaultLocale: null,
    localePrefix: null,
    pathnames: null,
    routingFile: null,
    requestFile: null,
  };

  info.requestFile = findFirst(cwd, REQUEST_CANDIDATES);
  info.routingFile = findFirst(cwd, ROUTING_CANDIDATES);
  if (!info.routingFile) return info;

  const config = extractRoutingObject(
    fs.readFileSync(info.routingFile, 'utf8')
  );
  if (!config) return info;

  const locales = staticValue(getProperty(config, 'locales'));
  if (Array.isArray(locales) && locales.every((l) => typeof l === 'string')) {
    info.locales = locales as string[];
  }
  const defaultLocale = staticValue(getProperty(config, 'defaultLocale'));
  if (typeof defaultLocale === 'string') info.defaultLocale = defaultLocale;

  const localePrefixNode = getProperty(config, 'localePrefix');
  const prefixMode = readLocalePrefixMode(localePrefixNode);
  if (
    prefixMode === 'always' ||
    prefixMode === 'as-needed' ||
    prefixMode === 'never'
  ) {
    info.localePrefix = prefixMode;
  } else if (localePrefixNode) {
    // Present but not one of the three literal modes (a shorthand variable
    // reference, a computed value, an object with a dynamic `mode`). Flag it
    // so callers do not read the null above as next-intl's default 'always'
    // and silently rewrite the app's public URL structure.
    info.localePrefixUnresolved = true;
  }

  const pathnamesNode = getProperty(config, 'pathnames');
  const pathnames = staticValue(pathnamesNode);
  if (pathnames && typeof pathnames === 'object' && !Array.isArray(pathnames)) {
    info.pathnames = pathnames as Record<string, unknown>;
  } else if (pathnamesNode) {
    // Present but not a statically resolvable object (a variable reference, a
    // function call). Flag it so localized-pathname handling is not silently
    // dropped by reading the null as absent.
    info.pathnamesUnresolved = true;
  }

  // A spread ({ ...base }, or an inline object literal) may carry
  // localePrefix/pathnames or override a value set before it, and getProperty
  // never reads inside one. Any field not resolved by a property appearing
  // AFTER the last such spread is downgraded to unresolved so the
  // middleware/navigation transforms skip (with a TODO) instead of assuming a
  // default. A property placed after the spread wins in JS object semantics, so
  // that value is kept.
  const lastSpreadIndex = lastUnresolvableSpreadIndex(config);
  if (lastSpreadIndex >= 0) {
    const localePrefixIndex = propertyIndex(config, 'localePrefix');
    if (!(info.localePrefix !== null && localePrefixIndex > lastSpreadIndex)) {
      info.localePrefix = null;
      info.localePrefixUnresolved = true;
    }
    const pathnamesIndex = propertyIndex(config, 'pathnames');
    if (!(info.pathnames !== null && pathnamesIndex > lastSpreadIndex)) {
      info.pathnames = null;
      info.pathnamesUnresolved = true;
    }
  }

  return info;
}

/**
 * Index of the last spread in the object, or -1 when there is none. Every
 * SpreadElement counts, including one whose argument is a static inline object
 * literal (`...{ localePrefix: 'as-needed' }`): getProperty never reads inside a
 * spread, so its localePrefix/pathnames would otherwise be seen as absent rather
 * than downgraded to unresolved, and the transforms would proceed on next-intl's
 * defaults. Treating every spread as unresolvable forces those fields to
 * unresolved unless a literal property after the last spread resolves them.
 */
function lastUnresolvableSpreadIndex(object: t.ObjectExpression): number {
  let last = -1;
  for (let i = 0; i < object.properties.length; i++) {
    if (t.isSpreadElement(object.properties[i])) {
      last = i;
    }
  }
  return last;
}

/** Index of the first direct (non-computed) property named `name`, else -1. */
function propertyIndex(object: t.ObjectExpression, name: string): number {
  for (let i = 0; i < object.properties.length; i++) {
    const property = object.properties[i];
    if (
      t.isObjectProperty(property) &&
      !property.computed &&
      (t.isIdentifier(property.key, { name }) ||
        (t.isStringLiteral(property.key) && property.key.value === name))
    ) {
      return i;
    }
  }
  return -1;
}

/**
 * True when localePrefix is the object form carrying a non-empty `prefixes`
 * map (per-locale prefix overrides, e.g. `{ mode: 'always', prefixes: {...} }`).
 * next-intl uses these to swap the URL segment per locale; gt-next has no
 * equivalent, so the middleware transform surfaces a TODO.
 *
 * Re-reads the already-located routing file rather than widening RoutingInfo
 * (that shared type is owned by another lane). Detection is AST-level so a
 * dynamic prefix value still trips the warning.
 */
export function localePrefixHasCustomPrefixes(
  routingFile: string | null
): boolean {
  if (!routingFile) return false;
  let source: string;
  try {
    source = fs.readFileSync(routingFile, 'utf8');
  } catch {
    return false;
  }
  const config = extractRoutingObject(source);
  if (!config) return false;
  const localePrefix = getProperty(config, 'localePrefix');
  if (!localePrefix) return false;
  const unwrapped = unwrapAssertion(localePrefix);
  if (!t.isObjectExpression(unwrapped)) return false;
  const prefixes = getProperty(unwrapped, 'prefixes');
  if (!prefixes) return false;
  const prefixesNode = unwrapAssertion(prefixes);
  if (!t.isObjectExpression(prefixesNode)) {
    // A dynamic prefixes value (a variable reference, a call) still means
    // per-locale URL prefixes exist as far as we can tell statically, so the
    // middleware drop-TODO must fire rather than silently convert them away.
    return true;
  }
  return prefixesNode.properties.length > 0;
}

function findFirst(cwd: string, candidates: string[]): string | null {
  for (const candidate of candidates) {
    const abs = path.join(cwd, candidate);
    if (fs.existsSync(abs)) return abs;
  }
  return null;
}

/**
 * Finds the object literal passed to defineRouting(...), or a plain exported
 * object literal carrying both `locales` and `defaultLocale`.
 */
function extractRoutingObject(source: string): t.ObjectExpression | null {
  let ast: t.File;
  try {
    ast = parse(source, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });
  } catch {
    return null;
  }

  let found: t.ObjectExpression | null = null;
  traverse(ast, {
    CallExpression(nodePath) {
      if (
        !found &&
        t.isIdentifier(nodePath.node.callee, { name: 'defineRouting' }) &&
        t.isObjectExpression(nodePath.node.arguments[0])
      ) {
        found = nodePath.node.arguments[0];
      }
    },
    ObjectExpression(nodePath) {
      if (
        !found &&
        getProperty(nodePath.node, 'locales') &&
        getProperty(nodePath.node, 'defaultLocale')
      ) {
        found = nodePath.node;
      }
    },
  });
  return found;
}

function getProperty(object: t.ObjectExpression, name: string): t.Node | null {
  for (const property of object.properties) {
    if (
      t.isObjectProperty(property) &&
      !property.computed &&
      (t.isIdentifier(property.key, { name }) ||
        (t.isStringLiteral(property.key) && property.key.value === name))
    ) {
      return property.value;
    }
  }
  return null;
}

/** Unwraps TS `as`/`satisfies` assertions to reach the underlying node. */
function unwrapAssertion(node: t.Node): t.Node {
  return t.isTSAsExpression(node) || t.isTSSatisfiesExpression(node)
    ? unwrapAssertion(node.expression)
    : node;
}

/**
 * Resolves next-intl's localePrefix to its mode. Accepts the bare string form
 * ('always' | 'as-needed' | 'never') and the object form ({ mode, prefixes }),
 * reading `mode` straight from the AST so a dynamic `prefixes` map cannot hide
 * an otherwise-static mode.
 */
function readLocalePrefixMode(node: t.Node | null): unknown {
  if (!node) return null;
  const unwrapped = unwrapAssertion(node);
  if (t.isStringLiteral(unwrapped)) return unwrapped.value;
  if (t.isObjectExpression(unwrapped)) {
    const mode = getProperty(unwrapped, 'mode');
    return mode ? staticValue(mode) : null;
  }
  return null;
}

/**
 * Literal-only static evaluation: strings, numbers, booleans, arrays, and
 * plain objects, unwrapping TS `as`/`satisfies` assertions. Returns
 * undefined for anything dynamic.
 */
function staticValue(node: t.Node | null): unknown {
  if (!node) return undefined;
  if (t.isTSAsExpression(node) || t.isTSSatisfiesExpression(node)) {
    return staticValue(node.expression);
  }
  if (t.isStringLiteral(node)) return node.value;
  if (t.isNumericLiteral(node)) return node.value;
  if (t.isBooleanLiteral(node)) return node.value;
  if (t.isArrayExpression(node)) {
    const values: unknown[] = [];
    for (const element of node.elements) {
      const value = element ? staticValue(element) : undefined;
      if (value === undefined) return undefined;
      values.push(value);
    }
    return values;
  }
  if (t.isObjectExpression(node)) {
    const result: Record<string, unknown> = {};
    for (const property of node.properties) {
      if (!t.isObjectProperty(property) || property.computed) return undefined;
      const key = t.isIdentifier(property.key)
        ? property.key.name
        : t.isStringLiteral(property.key)
          ? property.key.value
          : null;
      if (key === null) return undefined;
      const value = staticValue(property.value);
      if (value === undefined) return undefined;
      result[key] = value;
    }
    return result;
  }
  return undefined;
}
