import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';
import type { RoutingInfo } from './types.js';

const traverse = traverseModule.default || traverseModule;

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
 * of guessing.
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

  const localePrefix = staticValue(getProperty(config, 'localePrefix'));
  const prefixMode =
    typeof localePrefix === 'string'
      ? localePrefix
      : localePrefix && typeof localePrefix === 'object'
        ? (localePrefix as Record<string, unknown>).mode
        : null;
  if (
    prefixMode === 'always' ||
    prefixMode === 'as-needed' ||
    prefixMode === 'never'
  ) {
    info.localePrefix = prefixMode;
  }

  const pathnames = staticValue(getProperty(config, 'pathnames'));
  if (pathnames && typeof pathnames === 'object' && !Array.isArray(pathnames)) {
    info.pathnames = pathnames as Record<string, unknown>;
  }

  return info;
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

function getProperty(
  object: t.ObjectExpression,
  name: string
): t.Node | null {
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
