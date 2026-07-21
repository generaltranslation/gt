import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';
import { matchFiles } from '../fs/matchFiles.js';
import type {
  FileEdit,
  MessageCatalogs,
  RoutingInfo,
  TodoEntry,
} from '../types.js';

const traverse: typeof traverseModule =
  (traverseModule as { default?: typeof traverseModule }).default ||
  traverseModule;

// FormatJS ships catalogs under a few conventional dirs; check the react-intl
// ones ahead of the shared next-intl defaults.
const CATALOG_DIRS = [
  'messages',
  'src/messages',
  'lang',
  'src/lang',
  'compiled-lang',
  'src/compiled-lang',
  'locales',
  'src/locales',
];

/**
 * Locates react-intl's per-locale catalogs and loads each. Accepts both the
 * compiled/flat shape (`{ id: 'ICU' }`) and the extracted/authoring shape
 * (`{ id: { defaultMessage, description } }`, read via `.defaultMessage`).
 * AST-compiled catalogs (`compile --ast`, arrays of MessageFormatElement) throw
 * a clear error (gt wants ICU source strings).
 *
 * react-intl catalogs are flat (`{ "Home.title": … }`), but gt-next's dictionary
 * resolver walks ids as nested dotted paths (`id.split('.')`), so any dotted key
 * would throw at runtime if reused verbatim. Dotted keys are therefore re-nested
 * (`{"a.b":x}` -> `{a:{b:x}}`) into NEW files (originals are never mutated) and
 * loadDictionary is pointed at them via `dir`. Keys that collide as both a leaf
 * and a namespace (`"a"` and `"a.b"` both present) cannot be nested and are
 * reported so the transform skips files that reference them.
 *
 * The id-problem cases are handled here too: when the default-locale catalog is
 * absent (case b2) it is synthesized from literal `defaultMessage`s harvested
 * across the source; when it is present but missing some ids (a partial
 * extraction), those ids are synthesized per-id from their inline
 * `defaultMessage`. Both write NEW files only.
 */
export async function discoverReactIntlCatalogs(
  cwd: string,
  routing: RoutingInfo
): Promise<MessageCatalogs | null> {
  const dir = CATALOG_DIRS.map((candidate) => path.join(cwd, candidate)).find(
    (candidate) =>
      fs.existsSync(candidate) &&
      fs.statSync(candidate).isDirectory() &&
      fs.readdirSync(candidate).some((file) => file.endsWith('.json'))
  );
  if (!dir) return null;

  const stems = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => path.basename(file, '.json'));
  const locales = routing.locales
    ? stems.filter((stem) => routing.locales!.includes(stem))
    : stems;

  // Flat, per the on-disk react-intl shape. Re-nested below before returning.
  const flatByLocale: Record<string, Record<string, unknown>> = {};
  for (const locale of locales) {
    const file = path.join(dir, `${locale}.json`);
    flatByLocale[locale] = normalizeCatalog(file);
  }

  const resolved = determineDefaultLocale(cwd, routing, locales);
  if (!resolved) return null;
  const defaultLocale = resolved.locale;

  const warnings: string[] = [];
  const reportTodos: TodoEntry[] = [];
  if (resolved.assumption) warnings.push(resolved.assumption);

  // Harvest inline defaultMessages across the whole project (deterministic file
  // order, with conflict detection); used to synthesize or fill the default
  // catalog. Cheap when nothing is missing (the results are simply unused).
  const { harvested, conflicts } = harvestDefaultMessages(cwd);

  const finalLocales = [...locales];
  const synthesizedIds: string[] = [];
  let b2Synthesized = false;
  let defaultAugmented = false;

  if (!(defaultLocale in flatByLocale)) {
    // Case b2: the source (default-locale) catalog is absent. Seed it entirely
    // from harvested defaultMessages so gt's dictionary has a source entry per
    // id (else t() throws at runtime).
    if (Object.keys(harvested).length === 0) {
      throw new Error(
        `No '${defaultLocale}' catalog was found in ${path.relative(cwd, dir) || '.'}/ and no literal ` +
          'defaultMessage could be harvested to synthesize one. gt-next needs a ' +
          'default-locale source entry per id (its dictionary throws on unknown ' +
          `keys). Add ${defaultLocale}.json, or give each formatMessage/` +
          '<FormattedMessage> a literal defaultMessage, then re-run gt migrate.'
      );
    }
    flatByLocale[defaultLocale] = { ...harvested };
    finalLocales.push(defaultLocale);
    b2Synthesized = true;
    synthesizedIds.push(...Object.keys(harvested));
  } else {
    // Case b1-partial (M4): the default catalog exists but may be missing ids
    // that are only present as inline defaultMessages. Fill each missing id
    // per-id from the harvest instead of skipping the whole file downstream.
    const def = flatByLocale[defaultLocale];
    for (const [id, message] of Object.entries(harvested)) {
      if (!(id in def)) {
        def[id] = message;
        defaultAugmented = true;
        synthesizedIds.push(id);
      }
    }
  }

  // Re-nest dotted keys per locale; collect flat/nested collisions.
  const byLocale: Record<string, Record<string, unknown>> = {};
  const collisions = new Set<string>();
  let anyReNested = false;
  for (const locale of Object.keys(flatByLocale)) {
    const unflattened = unflattenCatalog(flatByLocale[locale]);
    byLocale[locale] = unflattened.nested;
    unflattened.collisions.forEach((id) => collisions.add(id));
    if (unflattened.reNested) anyReNested = true;
  }

  // Resolve where the emitted default-locale catalog will actually live before
  // building report TODOs, so each TODO names the file the user should open. A
  // re-nest or an augmentation writes every locale to a sibling gt-owned dir
  // (originals are never mutated); otherwise the catalog stays in place. Either
  // way the default-locale catalog ends up at catalogDir/<defaultLocale>.json.
  const catalogDir =
    anyReNested || defaultAugmented
      ? path.join(path.dirname(dir), `${path.basename(dir)}-gt`)
      : dir;

  // Report synthesized entries and conflicting variants (only for ids we
  // actually synthesized; an authoritative catalog wins, so its inline
  // defaultMessage conflicts are not the migration's concern).
  const synthesizedSet = new Set(synthesizedIds);
  if (b2Synthesized) {
    reportTodos.push({
      file: path.join(catalogDir, `${defaultLocale}.json`),
      reason:
        `no ${defaultLocale}.json existed; synthesized the source catalog ` +
        `(${synthesizedIds.length} entr${synthesizedIds.length === 1 ? 'y' : 'ies'}) from inline ` +
        'defaultMessages so gt-next has a source entry per id; verify the text',
    });
  } else if (defaultAugmented) {
    reportTodos.push({
      file: path.join(catalogDir, `${defaultLocale}.json`),
      reason:
        `the ${defaultLocale} catalog was missing ${synthesizedIds.length} id(s) used in code ` +
        `(${synthesizedIds.slice(0, 10).join(', ')}${synthesizedIds.length > 10 ? ', …' : ''}); ` +
        'synthesized them from inline defaultMessages into a new file (the ' +
        'original catalog is left untouched); verify the text',
    });
  }
  for (const [id, variants] of conflicts) {
    if (!synthesizedSet.has(id)) continue;
    reportTodos.push({
      reason:
        `'${id}' has multiple inline defaultMessage variants across the source ` +
        `[${[...variants].map((v) => JSON.stringify(v)).join(' | ')}]; ` +
        `used ${JSON.stringify(harvested[id])} (first by file order) in the ` +
        'synthesized catalog; reconcile them so the source text is unambiguous',
      file: path.join(catalogDir, `${defaultLocale}.json`),
    });
  }
  if (collisions.size > 0) {
    warnings.push(
      'These catalog keys appear both as a value and as a namespace prefix ' +
        "(e.g. 'a' and 'a.b'), which gt-next's nested dictionary cannot " +
        `represent; files using them are skipped, so rename one: ${[...collisions].sort().join(', ')}`
    );
  }

  // Emit new catalog files only where required, and repoint `dir` at them
  // (catalogDir, resolved above). Reuse the originals verbatim in place when
  // nothing changed.
  const filesToEmit: FileEdit[] = [];
  if (anyReNested || defaultAugmented) {
    // Re-nesting or augmenting an existing catalog would mutate originals, so
    // write every locale to a sibling gt-owned directory and serve from there.
    for (const locale of finalLocales) {
      filesToEmit.push({
        path: path.join(catalogDir, `${locale}.json`),
        kind: 'write',
        content: JSON.stringify(byLocale[locale] ?? {}, null, 2) + '\n',
      });
    }
  } else if (b2Synthesized) {
    // No dotted keys and the default catalog file did not exist: writing it into
    // the original directory is a new file, not a mutation.
    filesToEmit.push({
      path: path.join(dir, `${defaultLocale}.json`),
      kind: 'write',
      content: JSON.stringify(byLocale[defaultLocale] ?? {}, null, 2) + '\n',
    });
  }

  return {
    defaultLocale,
    locales: finalLocales,
    byLocale,
    dir: catalogDir,
    ...(filesToEmit.length > 0 ? { filesToEmit } : {}),
    ...(collisions.size > 0 ? { flatKeyCollisions: [...collisions] } : {}),
    ...(warnings.length > 0 ? { warnings } : {}),
    ...(reportTodos.length > 0 ? { reportTodos } : {}),
  };
}

/**
 * Re-nests a flat catalog's dotted keys (`{"a.b": x}` -> `{a: {b: x}}`) so
 * gt-next's dotted-path resolver can find them. Keys that collide as both a leaf
 * and a namespace prefix (`"a"` and `"a.b"` both present) cannot be represented
 * and are dropped from the nested result and returned in `collisions`.
 */
function unflattenCatalog(flat: Record<string, unknown>): {
  nested: Record<string, unknown>;
  collisions: Set<string>;
  reNested: boolean;
} {
  const keys = Object.keys(flat);
  const collisions = detectFlatKeyCollisions(keys);
  const nested: Record<string, unknown> = {};
  let reNested = false;
  for (const key of keys) {
    if (collisions.has(key)) continue;
    if (!key.includes('.')) {
      nested[key] = flat[key];
      continue;
    }
    reNested = true;
    const segments = key.split('.');
    let current = nested;
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i];
      const next = current[segment];
      if (next === undefined || next === null || typeof next !== 'object') {
        current[segment] = {};
      }
      current = current[segment] as Record<string, unknown>;
    }
    current[segments[segments.length - 1]] = flat[key];
  }
  return { nested, collisions, reNested };
}

/**
 * Ids that collide because one is a strict dotted-segment prefix of another
 * (`"a"` vs `"a.b"`, or `"a.b"` vs `"a.b.c"`). Both sides of every such pair are
 * returned. Sibling keys under a shared prefix (`"a.b"` vs `"a.c"`) do not
 * collide; they nest cleanly under `a`.
 */
function detectFlatKeyCollisions(keys: string[]): Set<string> {
  const collided = new Set<string>();
  const split = keys.map((key) => ({ key, segments: key.split('.') }));
  for (let i = 0; i < split.length; i++) {
    for (let j = 0; j < split.length; j++) {
      if (i === j) continue;
      if (isStrictSegmentPrefix(split[i].segments, split[j].segments)) {
        collided.add(split[i].key);
        collided.add(split[j].key);
      }
    }
  }
  return collided;
}

function isStrictSegmentPrefix(a: string[], b: string[]): boolean {
  if (a.length >= b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/** Reads a catalog file and flattens it to `{ id: ICU-string }`. */
function normalizeCatalog(file: string): Record<string, unknown> {
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(
      `Could not parse message catalog ${file}: ${String(error)}. ` +
        'Fix the JSON (no comments, trailing commas, or BOM) and re-run.'
    );
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(
      `Message catalog ${file} is not a JSON object of messages.`
    );
  }
  const result: Record<string, unknown> = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string') {
      result[id] = value;
    } else if (Array.isArray(value)) {
      throw new Error(
        `Message catalog ${file} looks AST-compiled (\`formatjs compile --ast\`): ` +
          'gt-next needs ICU source strings. Re-run `formatjs compile` without ' +
          '`--ast`, then re-run gt migrate.'
      );
    } else if (
      value !== null &&
      typeof value === 'object' &&
      typeof (value as Record<string, unknown>).defaultMessage === 'string'
    ) {
      // Extracted/authoring shape: read .defaultMessage, drop description.
      result[id] = (value as Record<string, unknown>).defaultMessage;
    } else {
      throw new Error(
        `Message catalog ${file} has an unrecognized entry for '${id}'. ` +
          'Expected an ICU string or `{ defaultMessage }`.'
      );
    }
  }
  return result;
}

/**
 * The default (source) locale, and (when it was inferred rather than declared)
 * a report-worthy note stating what was assumed and why. Resolution order:
 * an explicit routing default, else a `defaultLocale="…"` seen on an
 * IntlProvider/createIntl in the source (authoritative and no note when a single
 * value is declared; a deterministic pick with a note when files disagree), else
 * the heuristics ('en' when present, the sole locale, or 'en' as a last resort),
 * each of which is a guess and gets a note.
 */
function determineDefaultLocale(
  cwd: string,
  routing: RoutingInfo,
  locales: string[]
): { locale: string; assumption: string | null } | null {
  if (routing.defaultLocale) {
    return { locale: routing.defaultLocale, assumption: null };
  }
  const declared = scanDeclaredDefaultLocale(cwd);
  if (declared) {
    // A single declared value is authoritative. Conflicting declarations
    // across files cannot both be right, so pick deterministically (first in
    // sorted file order) but flag it instead of silently embedding a guess.
    if (declared.candidates.length <= 1) {
      return { locale: declared.locale, assumption: null };
    }
    return {
      locale: declared.locale,
      assumption:
        'Multiple source files declare different defaultLocale values ' +
        `(${declared.candidates.join(', ')}); used '${declared.locale}' (the ` +
        'first in sorted file order). If that is not your source language, set ' +
        'defaultLocale in gt.config.json and re-run.',
    };
  }
  if (locales.includes('en')) {
    return {
      locale: 'en',
      assumption:
        "Assumed the source (default) locale is 'en' because an en catalog is " +
        'present and no defaultLocale was declared in routing config or on an ' +
        '<IntlProvider>/createIntl. If your source language differs, set ' +
        'defaultLocale in gt.config.json and re-run.',
    };
  }
  if (locales.length === 1) {
    return {
      locale: locales[0],
      assumption:
        `Assumed '${locales[0]}' is the source (default) locale because it is ` +
        'the only catalog present and none was declared. Verify this is your ' +
        'source language (set defaultLocale in gt.config.json otherwise).',
    };
  }
  // Nothing to anchor on and multiple locales present; assume 'en' so the
  // harvest can seed it (real react-intl apps source from English).
  return {
    locale: 'en',
    assumption:
      "Assumed the source (default) locale is 'en' though no en catalog is " +
      'present and none was declared; the en source catalog is synthesized from ' +
      'inline defaultMessages. Verify this is your source language (set ' +
      'defaultLocale in gt.config.json otherwise).',
  };
}

/**
 * Scans the source for a declared `defaultLocale="…"` (on an IntlProvider /
 * createIntl). Files are visited in sorted order so the pick does not depend on
 * filesystem ordering. Returns the chosen locale (first match in sorted file
 * order) plus every distinct declared value; when more than one distinct value
 * is declared the caller treats the pick as an assumption, not authoritative.
 */
function scanDeclaredDefaultLocale(
  cwd: string
): { locale: string; candidates: string[] } | null {
  const pattern = /defaultLocale\s*[:=]\s*\{?\s*['"]([a-zA-Z][\w-]*)['"]/;
  let chosen: string | null = null;
  const distinct = new Set<string>();
  for (const file of [...sourceFiles(cwd)].sort()) {
    let content: string;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    if (!content.includes('defaultLocale')) continue;
    const match = content.match(pattern);
    if (!match) continue;
    if (chosen === null) chosen = match[1];
    distinct.add(match[1]);
  }
  if (chosen === null) return null;
  return { locale: chosen, candidates: [...distinct].sort() };
}

/**
 * Harvests `{ id: defaultMessage }` from every literal descriptor across the
 * source: `<FormattedMessage id defaultMessage />`, `formatMessage({ id,
 * defaultMessage })`, and `defineMessage(s)({ … })`. Files are visited in a
 * deterministic (sorted) order and first writer wins, so the result does not
 * depend on filesystem ordering. When an id recurs with a *different*
 * defaultMessage, every variant is recorded in `conflicts` so the caller can
 * report the ambiguity.
 */
function harvestDefaultMessages(cwd: string): {
  harvested: Record<string, string>;
  conflicts: Map<string, Set<string>>;
} {
  const harvested: Record<string, string> = {};
  const conflicts = new Map<string, Set<string>>();
  const record = (id: string | null, message: string | null) => {
    if (id === null || message === null) return;
    if (id in harvested) {
      if (harvested[id] !== message) {
        const variants = conflicts.get(id) ?? new Set([harvested[id]]);
        variants.add(message);
        conflicts.set(id, variants);
      }
      return;
    }
    harvested[id] = message;
  };

  for (const file of [...sourceFiles(cwd)].sort()) {
    let code: string;
    try {
      code = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    if (!code.includes('defaultMessage')) continue;
    let ast: t.File;
    try {
      ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });
    } catch {
      continue;
    }
    traverse(ast, {
      JSXOpeningElement(path) {
        if (!t.isJSXIdentifier(path.node.name, { name: 'FormattedMessage' })) {
          return;
        }
        record(
          jsxStringAttr(path.node, 'id'),
          jsxStringAttr(path.node, 'defaultMessage')
        );
      },
      CallExpression(path) {
        const callee = path.node.callee;
        const isFormatMessage =
          t.isMemberExpression(callee) &&
          !callee.computed &&
          t.isIdentifier(callee.property, { name: 'formatMessage' });
        const isDefine =
          t.isIdentifier(callee, { name: 'defineMessages' }) ||
          t.isIdentifier(callee, { name: 'defineMessage' });
        if (isFormatMessage) {
          recordFromDescriptor(path.node.arguments[0], record);
        } else if (isDefine) {
          const arg = path.node.arguments[0];
          if (t.isObjectExpression(arg)) {
            for (const property of arg.properties) {
              if (
                t.isObjectProperty(property) &&
                t.isObjectExpression(property.value)
              ) {
                recordFromDescriptor(property.value, record);
              }
            }
          }
        }
      },
    });
  }
  return { harvested, conflicts };
}

function recordFromDescriptor(
  node: t.Node | undefined,
  record: (id: string | null, message: string | null) => void
): void {
  if (!node || !t.isObjectExpression(node)) return;
  record(
    objectStringProp(node, 'id'),
    objectStringProp(node, 'defaultMessage')
  );
}

function objectStringProp(
  object: t.ObjectExpression,
  name: string
): string | null {
  for (const property of object.properties) {
    if (
      t.isObjectProperty(property) &&
      !property.computed &&
      t.isIdentifier(property.key, { name }) &&
      t.isStringLiteral(property.value)
    ) {
      return property.value.value;
    }
  }
  return null;
}

function jsxStringAttr(
  opening: t.JSXOpeningElement,
  name: string
): string | null {
  for (const attr of opening.attributes) {
    if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name, { name })) {
      continue;
    }
    const value = attr.value;
    if (t.isStringLiteral(value)) return value.value;
    if (
      t.isJSXExpressionContainer(value) &&
      t.isStringLiteral(value.expression)
    ) {
      return value.expression.value;
    }
  }
  return null;
}

function sourceFiles(cwd: string): string[] {
  return matchFiles(cwd, [
    '**/*.{js,jsx,ts,tsx}',
    '!**/node_modules/**',
    '!**/.next/**',
    '!**/dist/**',
    '!**/build/**',
    '!**/out/**',
    '!**/coverage/**',
  ]);
}
