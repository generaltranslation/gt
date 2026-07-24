import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';
import type { MigrationContext } from './types.js';

const traverse: typeof traverseModule =
  (traverseModule as { default?: typeof traverseModule }).default ||
  traverseModule;

/** The gt-next modules the converted call sites resolve their keys through. */
const GT_MODULES = new Set(['gt-next', 'gt-next/server', 'gt-next/client']);
/** The dictionary-backed factories. Both throw on an unknown key. */
const GT_FACTORIES = new Set(['useTranslations', 'getTranslations']);

/**
 * Cross-checks every key a converted call site asks for against the catalog
 * this run points gt-next at, and reports the ones that are not there.
 *
 * This is a behavior change the import swap makes silently: next-intl's default
 * `getMessageFallback` renders a missing key as its own key path and logs
 * (`MISSING_MESSAGE`), so the page still renders; gt-next throws
 * "Dictionary entry <key> cannot be found", which is a 500 on a dynamically
 * rendered route and a failed `next build` on a prerendered one. Round 9
 * measured four such call sites in one real app (memo-engine), against 1,202
 * keys that resolved fine in another, so it is catalog-gap dependent rather
 * than universal, and the report named none of them.
 *
 * Deliberately report-only (per-site TODO plus one counted warning): the app is
 * otherwise correctly migrated, and holding whole files back for a key their
 * author already got wrong would cost more than it saves.
 *
 * A computed key (`t(`step.${index}`)`) cannot be resolved at codemod time, so
 * it is never claimed missing; it gets a per-site TODO instead, naming the
 * static prefix that IS checkable, on the adapters that do not already report
 * their dynamic call sites (react-i18next does; next-intl reported nothing at
 * all, which left memo-engine's 10 template-literal sites silent on an engine
 * that throws on a miss: round-9 re-attack B7).
 *
 * Conservative by construction; every uncertainty resolves to silence:
 *  - only STATIC keys are ever reported as missing;
 *  - factory bindings are resolved through scope (binding identity, not name),
 *    so a shadowed `t` cannot be attributed to the wrong namespace;
 *  - a key counts as present if it resolves in ANY shape the dictionary
 *    accepts (nested path, a flat dotted leaf, or a flat leaf inside its
 *    namespace object);
 *  - with no readable default-locale catalog, nothing is claimed at all.
 */
export function auditConvertedDictionaryKeys(ctx: MigrationContext): void {
  const catalogs = defaultLocaleCatalogs(ctx);
  if (catalogs.length === 0) return;

  const misses: { file: string; line: number; key: string; full: string }[] =
    [];
  const catalogPath =
    path.relative(
      ctx.cwd,
      path.join(ctx.catalogs.dir, `${ctx.catalogs.defaultLocale}.json`)
    ) || `${ctx.catalogs.defaultLocale}.json`;
  const posixCatalogPath = catalogPath.split(path.sep).join('/');
  for (const edit of ctx.edits) {
    if (edit.kind !== 'write') continue;
    if (!/\.[cm]?[jt]sx?$/.test(edit.path)) continue;
    const code = edit.content ?? '';
    if (!code.includes('gt-next')) continue;
    let hasFactory = false;
    for (const factory of GT_FACTORIES) {
      if (code.includes(factory)) hasFactory = true;
    }
    if (!hasFactory) continue;
    let ast: t.File;
    try {
      ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });
    } catch {
      // The transforms own parse diagnostics; an unparseable emit is their bug
      // to report, and guessing keys out of it would be worse than silence.
      continue;
    }
    const sites = collectKeySites(ast);
    for (const site of sites.static) {
      const full = site.namespace ? `${site.namespace}.${site.key}` : site.key;
      if (catalogs.some((catalog) => hasDictionaryKey(catalog, full))) continue;
      misses.push({ file: edit.path, line: site.line, key: site.key, full });
    }
    if (ctx.adapter.reportsComputedKeys) continue;
    for (const site of sites.computed) {
      const display = site.namespace
        ? `${site.namespace}.${site.expression}`
        : site.expression;
      // The checkable part: the namespace plus whatever leading path segments
      // the key expression spells out before its first interpolation. Nothing
      // below that can be verified, so the TODO says exactly that.
      const prefix = [site.namespace, site.staticPrefix]
        .filter((part): part is string => part !== null && part !== '')
        .join('.');
      const prefixClause =
        prefix === ''
          ? 'No part of it is static, so nothing about it could be checked.'
          : catalogs.some((catalog) => hasDictionaryKey(catalog, prefix))
            ? `Its static prefix '${prefix}' IS in ${posixCatalogPath}; the keys under it were not checked.`
            : `Its static prefix '${prefix}' is NOT in ${posixCatalogPath}, so every key this expression builds will throw.`;
      ctx.todos.push({
        file: edit.path,
        line: site.line,
        reason:
          `computed key \`${display}\`: gt migrate cannot resolve it, so it ` +
          `was not checked against ${posixCatalogPath}. ${prefixClause} Verify ` +
          'that every key this expression can produce exists (in every locale): ' +
          'gt-next THROWS "Dictionary entry <key> cannot be found" on a miss, ' +
          `where ${ctx.adapter.displayName} rendered the raw key and logged`,
      });
    }
  }
  if (misses.length === 0) return;
  for (const miss of misses) {
    ctx.todos.push({
      file: miss.file,
      line: miss.line,
      reason:
        `t('${miss.key}') resolves to the dictionary key '${miss.full}', which ` +
        `is not in ${posixCatalogPath}. ` +
        `${ctx.adapter.displayName} rendered a missing key as its own name and ` +
        'logged it, so this call site still rendered; gt-next throws ' +
        `"Dictionary entry ${miss.full} cannot be found" instead, which is a 500 ` +
        'on a dynamically rendered route and a failed `next build` on a ' +
        'prerendered one. Add the key to your catalogs (every locale), or keep ' +
        `this call site on ${ctx.adapter.displayName}`,
    });
  }
  const sample = misses
    .slice(0, 3)
    .map((miss) => `${toRelative(ctx, miss.file)}:${miss.line} -> ${miss.full}`)
    .join(', ');
  (ctx.warnings ??= []).push(
    `${misses.length} converted call site(s) ask for dictionary keys that are ` +
      `not in ${posixCatalogPath} (${sample}${
        misses.length > 3 ? ', …' : ''
      }): gt-next THROWS on an unknown key where ${ctx.adapter.displayName} ` +
      'rendered the raw key and logged, so those routes now 500 (or fail the ' +
      'build where they prerender). Each one has a TODO with its file, line, ' +
      'and key; add the keys to your catalogs before shipping.'
  );
}

function toRelative(ctx: MigrationContext, file: string): string {
  return path.relative(ctx.cwd, file).split(path.sep).join('/');
}

/**
 * Every catalog object a converted key could legitimately resolve in: the
 * default-locale catalog discovery parsed, plus any default-locale JSON this
 * run emits (the react-i18next adapter rewrites i18next JSON into merged ICU
 * dictionaries, and the react-intl one re-nests dotted flat keys, so the
 * emitted file is the one gt-next will actually read). The union only ever
 * makes a key resolvable, which is the safe direction for a report.
 */
function defaultLocaleCatalogs(ctx: MigrationContext): unknown[] {
  const catalogs: unknown[] = [];
  const source = ctx.catalogs.byLocale?.[ctx.catalogs.defaultLocale];
  if (source && typeof source === 'object') catalogs.push(source);
  const locale = ctx.catalogs.defaultLocale;
  for (const edit of ctx.edits) {
    if (edit.kind !== 'write' || !edit.path.endsWith('.json')) continue;
    const posix = edit.path.split(path.sep).join('/');
    const base = path.basename(edit.path, '.json');
    if (base !== locale && !posix.includes(`/${locale}/`)) continue;
    try {
      const parsed: unknown = JSON.parse(
        edit.content ?? (fs.readFileSync(edit.path, 'utf8') as string)
      );
      if (parsed && typeof parsed === 'object') catalogs.push(parsed);
    } catch {
      // Unparseable emitted catalog: another stage's diagnostic, and a bad
      // parse here must not turn into a false "missing key" claim.
      return [];
    }
  }
  return catalogs;
}

/** True when `key` resolves in this catalog, in any shape gt-next accepts. */
function hasDictionaryKey(catalog: unknown, key: string): boolean {
  if (!catalog || typeof catalog !== 'object') return false;
  const record = catalog as Record<string, unknown>;
  if (key in record) return true;
  const segments = key.split('.');
  // Nested path, plus every "resolved prefix + flat remainder" split, which is
  // how a flat leaf inside a namespace object ({ UI: { 'a.b': … } }) resolves.
  let cursor: unknown = record;
  for (let index = 0; index < segments.length; index += 1) {
    if (!cursor || typeof cursor !== 'object') return false;
    const level = cursor as Record<string, unknown>;
    const remainder = segments.slice(index).join('.');
    if (remainder in level) return true;
    if (!(segments[index] in level)) return false;
    cursor = level[segments[index]];
  }
  return cursor !== undefined;
}

type StaticKeySite = { namespace: string | null; key: string; line: number };
type ComputedKeySite = {
  namespace: string | null;
  /** the key argument rendered with each interpolation as `${...}` */
  expression: string;
  /** the leading key path the expression spells out literally, or null */
  staticPrefix: string | null;
  line: number;
};

/**
 * The dictionary lookups in one emitted file: `t(...)` calls whose `t` is bound
 * to a gt-next `useTranslations(ns)` / `getTranslations(ns)` result, split into
 * the ones whose key is a literal and the ones that compute it. Bindings are
 * matched by IDENTITY through babel's scope, so two same-named locals in
 * different scopes never mix their namespaces.
 */
function collectKeySites(ast: t.File): {
  static: StaticKeySite[];
  computed: ComputedKeySite[];
} {
  const empty = { static: [], computed: [] };
  const factoryLocals = new Set<string>();
  for (const statement of ast.program.body) {
    if (!t.isImportDeclaration(statement)) continue;
    if (!GT_MODULES.has(statement.source.value)) continue;
    if (statement.importKind === 'type') continue;
    for (const specifier of statement.specifiers) {
      if (
        t.isImportSpecifier(specifier) &&
        t.isIdentifier(specifier.imported) &&
        GT_FACTORIES.has(specifier.imported.name)
      ) {
        factoryLocals.add(specifier.local.name);
      }
    }
  }
  if (factoryLocals.size === 0) return empty;

  // declarator id node -> namespace ('' = root scope, null = not static)
  const bindings = new Map<t.Identifier, string | null>();
  traverse(ast, {
    VariableDeclarator(declPath) {
      const id = declPath.node.id;
      if (!t.isIdentifier(id)) return;
      let init = declPath.node.init;
      if (t.isAwaitExpression(init)) init = init.argument;
      if (!t.isCallExpression(init)) return;
      if (
        !t.isIdentifier(init.callee) ||
        !factoryLocals.has(init.callee.name)
      ) {
        return;
      }
      bindings.set(id, namespaceOf(init.arguments[0]));
    },
  });
  if (bindings.size === 0) return empty;

  const staticSites: StaticKeySite[] = [];
  const computedSites: ComputedKeySite[] = [];
  traverse(ast, {
    CallExpression(callPath) {
      const callee = callPath.node.callee;
      if (!t.isIdentifier(callee)) return;
      const binding = callPath.scope.getBinding(callee.name);
      if (!binding) return;
      const namespace = bindings.get(binding.identifier);
      // `undefined` = not one of our factory results; `null` = a namespace we
      // could not read statically, so its keys are unresolvable by definition.
      if (namespace === undefined || namespace === null) return;
      const scope = namespace === '' ? null : namespace;
      const line = callPath.node.loc?.start.line ?? 0;
      const argument = callPath.node.arguments[0];
      const key = staticKey(argument);
      if (key !== null) {
        staticSites.push({ namespace: scope, key, line });
        return;
      }
      // A `t()` with no argument at all is not a lookup; anything else is one
      // whose key this process cannot resolve.
      if (argument === undefined) return;
      computedSites.push({
        namespace: scope,
        expression: renderComputedKey(argument),
        staticPrefix: staticKeyPrefix(argument),
        line,
      });
    },
  });
  return { static: staticSites, computed: computedSites };
}

/**
 * A computed key argument as the report shows it: a template literal keeps its
 * literal chunks with every interpolation collapsed to `${...}`
 * (`` `step.${index}` `` -> `step.${...}`), and any other expression (an
 * identifier, a member access, a call) is just `${...}`, since its text would
 * tell the reader nothing the file does not already show.
 */
function renderComputedKey(argument: t.Node): string {
  if (!t.isTemplateLiteral(argument)) return '${...}';
  return argument.quasis
    .map((quasi) => quasi.value.cooked ?? quasi.value.raw)
    .join('${...}');
}

/**
 * The dictionary path a computed key is guaranteed to sit under: the literal
 * lead of a template literal up to its last '.' before the first interpolation
 * (`` `step.${i}` `` -> 'step'). Null when the key starts computing immediately,
 * or when its literal lead names no complete segment ('' for `` `${i}` ``,
 * 'stepX' for `` `stepX${i}` `` -- the latter is a fragment of a segment, not a
 * parent of one, so it is not a checkable prefix).
 */
function staticKeyPrefix(argument: t.Node): string | null {
  if (!t.isTemplateLiteral(argument) || argument.quasis.length === 0) {
    return null;
  }
  const lead = argument.quasis[0].value.cooked ?? argument.quasis[0].value.raw;
  const lastDot = lead.lastIndexOf('.');
  return lastDot <= 0 ? null : lead.slice(0, lastDot);
}

/**
 * The namespace a factory call scopes its keys to: `useTranslations('UI')`,
 * `getTranslations({ locale, namespace: 'UI' })`, or the root dictionary when
 * called with no argument. Null when it is there but not a static string.
 */
function namespaceOf(argument: t.Node | undefined): string | null {
  if (argument === undefined) return '';
  const literal = staticKey(argument);
  if (literal !== null) return literal;
  if (t.isObjectExpression(argument)) {
    for (const property of argument.properties) {
      if (!t.isObjectProperty(property)) continue;
      if (!t.isIdentifier(property.key, { name: 'namespace' })) continue;
      return staticKey(property.value);
    }
    // A namespace-less options object ({ locale }) reads the root dictionary.
    return '';
  }
  return null;
}

/** A string literal's value (template literals only when they interpolate
 *  nothing), or null for anything computed. */
function staticKey(node: t.Node | undefined | null): string | null {
  if (t.isStringLiteral(node)) return node.value;
  if (
    t.isTemplateLiteral(node) &&
    node.expressions.length === 0 &&
    node.quasis.length === 1
  ) {
    return node.quasis[0].value.cooked ?? node.quasis[0].value.raw;
  }
  return null;
}
