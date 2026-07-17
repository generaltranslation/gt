import fs from 'node:fs';
import path from 'node:path';
import { lt, minVersion, valid } from 'semver';
import type { FileEdit, MigrationContext } from './types.js';

/** next/root-params (and its `locale()` export) landed in Next 15.5.0. */
const NEXT_ROOT_PARAMS_MIN_VERSION = '15.5.0';

/**
 * Emits the gt-next scaffolding: gt.config.json (merged with any existing
 * one), a loadDictionary loader for the preserved per-locale catalogs, the
 * package.json edit, and deletions of the now-unused next-intl config files.
 * next-intl teardown only happens once no skipped files remain.
 */
export function emitGtFiles(ctx: MigrationContext): FileEdit[] {
  const edits: FileEdit[] = [];
  const fullyMigrated = ctx.skippedFiles.size === 0;

  // gt.config.json
  const configPath = path.join(ctx.cwd, 'gt.config.json');
  let existing: Record<string, unknown> = {};
  if (fs.existsSync(configPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {
      // Unreadable existing config: preserve nothing, report via todo.
      ctx.todos.push({
        file: configPath,
        reason: 'existing gt.config.json could not be parsed and was replaced',
      });
    }
  }
  const existingFiles =
    existing.files && typeof existing.files === 'object'
      ? (existing.files as Record<string, unknown>)
      : {};
  const config = {
    ...existing,
    defaultLocale: ctx.catalogs.defaultLocale,
    locales: ctx.catalogs.locales,
    files: {
      ...existingFiles,
      gt: { output: 'public/_gt/[locale].json' },
    },
  };
  edits.push({
    path: configPath,
    kind: 'write',
    content: JSON.stringify(config, null, 2) + '\n',
  });

  // loadDictionary.ts — serves the preserved next-intl catalogs per locale.
  const loaderExists = [
    'loadDictionary.ts',
    'loadDictionary.js',
    'src/loadDictionary.ts',
    'src/loadDictionary.js',
  ].some((candidate) => fs.existsSync(path.join(ctx.cwd, candidate)));
  if (loaderExists) {
    ctx.todos.push({
      file: path.join(ctx.cwd, 'loadDictionary.ts'),
      reason:
        'a loadDictionary file already exists — verify it serves the migrated catalogs',
    });
  } else {
    // Place inside src/ when the app uses one (matches Next's compilation
    // scope — a root-level loader is detected by gt-next but its webpack
    // alias can fail to compile) and import relative to the file itself.
    const useSrc = fs.existsSync(path.join(ctx.cwd, 'src'));
    const loaderPath = path.join(
      ctx.cwd,
      useSrc ? 'src/loadDictionary.ts' : 'loadDictionary.ts'
    );
    const relativeDir = toPosix(
      path.relative(path.dirname(loaderPath), ctx.catalogs.dir)
    );
    const importDir = relativeDir.startsWith('.')
      ? relativeDir
      : `./${relativeDir}`;
    edits.push({
      path: loaderPath,
      kind: 'write',
      content: [
        'const loadDictionary = async (locale: string) => {',
        '  try {',
        `    return (await import(\`${importDir}/\${locale}.json\`)).default;`,
        '  } catch {',
        '    return {};',
        '  }',
        '};',
        '',
        'export default loadDictionary;',
        'export { loadDictionary };',
        '',
      ].join('\n'),
    });
  }

  // getLocale.ts / getRegion.ts — restore static (SSG) rendering. The
  // transformed layout resolves the locale from the [locale] route param, but
  // gt-next's server helpers and GTProvider otherwise fall back to
  // request-scoped headers()/cookies(), which forces every route dynamic (ƒ).
  // These two resolvers let withGTConfig (which auto-detects them at the root
  // or under src/) read the locale from next/root-params instead, keeping
  // statically-rendered routes static.
  emitStaticLocaleResolvers(ctx, edits);

  // package.json + next-intl config teardown, only when fully migrated.
  if (fullyMigrated) {
    const packageJsonPath = path.join(ctx.cwd, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      let pkg: Record<string, Record<string, string>> | null = null;
      try {
        pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      } catch (error) {
        ctx.todos.push({
          file: packageJsonPath,
          reason: `could not be parsed (${String(error)}) — remove the next-intl dependency by hand`,
        });
      }
      if (pkg) {
        let changed = false;
        for (const section of [
          'dependencies',
          'devDependencies',
          'peerDependencies',
          'optionalDependencies',
        ]) {
          if (pkg[section] && pkg[section]['next-intl']) {
            delete pkg[section]['next-intl'];
            changed = true;
          }
        }
        if (changed) {
          edits.push({
            path: packageJsonPath,
            kind: 'write',
            content: JSON.stringify(pkg, null, 2) + '\n',
          });
        }
      }
    }
    const deletions = [ctx.routing.routingFile, ctx.routing.requestFile].filter(
      (file): file is string => file !== null && fs.existsSync(file)
    );
    for (const configFile of deletions) {
      // Deleting a module that something still imports breaks the build —
      // keep it and say so instead.
      const importer = findRemainingImporter(ctx, configFile, deletions);
      if (importer) {
        ctx.todos.push({
          file: configFile,
          reason: `kept because ${path.relative(ctx.cwd, importer)} still imports it — migrate that reference off next-intl, then delete this file`,
        });
        continue;
      }
      edits.push({ path: configFile, kind: 'delete' });
    }
  }

  return edits;
}

/**
 * Emits the getLocale.ts / getRegion.ts resolvers next to loadDictionary.ts
 * (same src/-vs-root placement) so gt-next resolves the locale statically via
 * next/root-params. Several conditions gate the emission, each with its own
 * report TODO so the report never claims static rendering it did not restore:
 *  - the app must localize on a `[locale]` route segment (a differently-named
 *    segment like `[lang]` gets a rename TODO; no dynamic segment at all is a
 *    silent no-op — there is nothing to restore);
 *  - the target project's Next must be >= 15.5, since `next/root-params` only
 *    exists there — emitting the import on older Next breaks `next build`;
 *  - the `[locale]` layout must be the root layout, since next/root-params only
 *    exposes `locale` then (a separate root layout above it gets a merge TODO).
 */
function emitStaticLocaleResolvers(
  ctx: MigrationContext,
  edits: FileEdit[]
): void {
  const localeLayout = findLocaleLayout(ctx);
  if (localeLayout.kind === 'none') {
    // No localized route segment to anchor next/root-params on — nothing to
    // restore, so stay silent.
    return;
  }
  if (localeLayout.kind === 'other-segment') {
    ctx.todos.push({
      file: localeLayout.file,
      reason:
        'static rendering not restored: the localized route segment is not ' +
        'named [locale], but next/root-params only exposes a `locale()` ' +
        'export for a segment named literally [locale]. Rename the dynamic ' +
        'segment directory to [locale] (updating the imports/links that point ' +
        'at it), then re-run gt migrate so getLocale.ts/getRegion.ts can ' +
        'resolve the locale statically (SSG); otherwise GTProvider falls back ' +
        'to request-scoped headers/cookies and every route renders dynamically (ƒ).',
    });
    return;
  }

  // next/root-params only exists on Next >= 15.5. Emitting its import on an
  // older Next leaves an unresolvable module that breaks `next build`, so gate
  // the emission on the target project's actual Next version.
  if (!supportsRootParams(ctx.cwd)) {
    ctx.todos.push({
      file: localeLayout.file,
      reason:
        'static rendering not restored: getLocale.ts would import `locale` ' +
        "from 'next/root-params', which requires Next >= 15.5, but this " +
        "project's Next resolves below that (or could not be determined). On " +
        'Next 15.1–15.4, write getLocale.ts by hand using `unstable_rootParams` ' +
        "from 'next/server'; otherwise upgrade Next to >= 15.5 and re-run gt " +
        'migrate, or accept dynamic (ƒ) rendering.',
    });
    return;
  }

  if (localeLayout.hasRootLayoutAbove) {
    ctx.todos.push({
      file: localeLayout.file,
      reason:
        'static rendering not restored: a root layout sits above the [locale] ' +
        'segment, so next/root-params does not expose `locale`. Merge the root ' +
        'layout down into [locale]/layout.tsx, then add getLocale.ts (import ' +
        "{ locale } from 'next/root-params') and getRegion.ts next to " +
        'loadDictionary so withGTConfig can resolve the locale statically (SSG).',
    });
    return;
  }

  const useSrc = fs.existsSync(path.join(ctx.cwd, 'src'));
  emitResolverFile(
    ctx,
    edits,
    'getLocale',
    useSrc,
    [
      "import { locale } from 'next/root-params';",
      '',
      'export default async function getLocale() {',
      '  return await locale();',
      '}',
      '',
    ].join('\n'),
    'verify it resolves the locale from next/root-params so static rendering (SSG) is preserved'
  );
  emitResolverFile(
    ctx,
    edits,
    'getRegion',
    useSrc,
    [
      'export default async function getRegion() {',
      '  return undefined;',
      '}',
      '',
    ].join('\n'),
    'verify it does not read cookies()/headers() — a request-scoped region read forces dynamic rendering'
  );
}

/**
 * Writes a resolver file (getLocale/getRegion) with the same overwrite safety
 * as loadDictionary: if one already exists at the root or under src/, it is
 * left untouched and a TODO is filed instead.
 */
function emitResolverFile(
  ctx: MigrationContext,
  edits: FileEdit[],
  base: string,
  useSrc: boolean,
  content: string,
  existingNote: string
): void {
  const existing = [
    `${base}.ts`,
    `${base}.js`,
    `src/${base}.ts`,
    `src/${base}.js`,
  ].find((candidate) => fs.existsSync(path.join(ctx.cwd, candidate)));
  if (existing) {
    ctx.todos.push({
      file: path.join(ctx.cwd, existing),
      reason: `a ${base} file already exists — left untouched; ${existingNote}`,
    });
    return;
  }
  const filePath = path.join(ctx.cwd, useSrc ? `src/${base}.ts` : `${base}.ts`);
  edits.push({ path: filePath, kind: 'write', content });
}

/**
 * Result of locating the layout that anchors the localized route segment:
 *  - `locale`: a `[locale]` layout exists (with whether a root layout sits
 *    above it — next/root-params only exposes `locale` when it does not);
 *  - `other-segment`: a dynamic-segment layout exists but is not named
 *    `[locale]` (e.g. `[lang]`), which next/root-params cannot resolve;
 *  - `none`: no dynamic-segment layout at all — nothing to restore.
 */
type LocaleLayout =
  | { kind: 'locale'; file: string; hasRootLayoutAbove: boolean }
  | { kind: 'other-segment'; file: string }
  | { kind: 'none' };

/**
 * Locates the layout that owns the app's localized route segment among the
 * project's files. Prefers a `[locale]` layout (reporting whether a separate
 * root layout sits above it, e.g. app/layout.tsx above app/[locale]/layout.tsx),
 * and otherwise falls back to any other single dynamic segment (e.g. `[lang]`).
 * Uses the full project file list so the decision is not limited to the --src
 * scan.
 */
function findLocaleLayout(ctx: MigrationContext): LocaleLayout {
  const files = ctx.projectFiles ?? ctx.sourceFiles ?? [];
  const layouts = files.filter(isLayoutFileName);
  // The `[locale]` layout is the one that sits directly in the [locale]
  // segment (…/[locale]/layout.tsx) — not a deeper nested layout under it.
  const localeLayout = layouts.find(
    (file) => path.basename(path.dirname(file)) === '[locale]'
  );
  if (localeLayout) {
    const localeDir = path.dirname(localeLayout);
    const hasRootLayoutAbove = layouts.some(
      (file) =>
        file !== localeLayout &&
        isStrictAncestorDir(path.dirname(file), localeDir)
    );
    return { kind: 'locale', file: localeLayout, hasRootLayoutAbove };
  }
  // No `[locale]` layout, but a differently-named dynamic segment (e.g.
  // `[lang]`) still means the app localizes on a route param — flag it so the
  // report explains why static rendering was not restored.
  const otherSegment = layouts.find((file) =>
    isDynamicSegmentDir(path.basename(path.dirname(file)))
  );
  if (otherSegment) return { kind: 'other-segment', file: otherSegment };
  return { kind: 'none' };
}

function isLayoutFileName(file: string): boolean {
  const base = path.basename(file);
  return (
    base === 'layout.tsx' ||
    base === 'layout.ts' ||
    base === 'layout.jsx' ||
    base === 'layout.js'
  );
}

/**
 * A single dynamic route segment like `[lang]` or `[locale]` — not a catch-all
 * (`[...slug]`) or optional catch-all (`[[...slug]]`), neither of which is ever
 * a locale segment.
 */
function isDynamicSegmentDir(dir: string): boolean {
  return /^\[[^.[\]]+\]$/.test(dir);
}

/**
 * True when the target project's Next is new enough to expose
 * `next/root-params` (>= 15.5). Prefers the version actually installed at
 * node_modules/next; when that is absent, falls back to the conservative lower
 * bound of the `next` range declared in package.json. Returns false when the
 * version cannot be determined, so a broken `import … from 'next/root-params'`
 * is never emitted on faith.
 */
function supportsRootParams(cwd: string): boolean {
  const version =
    readInstalledNextVersion(cwd) ?? readDeclaredNextLowerBound(cwd);
  return version !== null && !lt(version, NEXT_ROOT_PARAMS_MIN_VERSION);
}

/** The exact Next version installed at node_modules/next, or null. */
function readInstalledNextVersion(cwd: string): string | null {
  const pkgPath = path.join(cwd, 'node_modules', 'next', 'package.json');
  if (!fs.existsSync(pkgPath)) return null;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
      version?: unknown;
    };
    return typeof pkg.version === 'string' ? valid(pkg.version) : null;
  } catch {
    return null;
  }
}

/**
 * The lowest Next version the project's declared `next` range permits, or null
 * when the range is missing or unparseable (e.g. `latest`, `workspace:*`).
 * Using the lower bound is deliberate: emit only when even the minimum
 * permitted Next supports next/root-params.
 */
function readDeclaredNextLowerBound(cwd: string): string | null {
  const pkgPath = path.join(cwd, 'package.json');
  if (!fs.existsSync(pkgPath)) return null;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const range = pkg.dependencies?.next ?? pkg.devDependencies?.next;
    if (typeof range !== 'string') return null;
    return minVersion(range)?.version ?? null;
  } catch {
    return null;
  }
}

function isStrictAncestorDir(ancestor: string, descendant: string): boolean {
  const rel = path.relative(ancestor, descendant);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/**
 * Finds a source file whose post-migration content still imports `target`.
 * Contents come from the pending edit when one exists, otherwise from disk.
 * Import specifiers resolve relative to the importer; `@/` and `~/` map to
 * src/ (or the project root when there is no src/).
 */
function findRemainingImporter(
  ctx: MigrationContext,
  target: string,
  ignoredFiles: string[]
): string | null {
  const targetNoExt = stripExtension(target);
  const pendingEdits = new Map(
    ctx.edits
      .filter((edit) => edit.kind === 'write')
      .map((edit) => [edit.path, edit.content ?? ''])
  );
  const aliasRoot = fs.existsSync(path.join(ctx.cwd, 'src'))
    ? path.join(ctx.cwd, 'src')
    : ctx.cwd;
  const specifierPattern =
    /(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g;

  for (const file of ctx.projectFiles ?? ctx.sourceFiles ?? []) {
    if (ignoredFiles.includes(file)) continue;
    const content =
      pendingEdits.get(file) ??
      (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');
    for (const match of content.matchAll(specifierPattern)) {
      const specifier = match[1];
      let resolved: string | null = null;
      if (specifier.startsWith('.')) {
        resolved = path.resolve(path.dirname(file), specifier);
      } else if (specifier.startsWith('@/') || specifier.startsWith('~/')) {
        resolved = path.join(aliasRoot, specifier.slice(2));
      }
      if (
        resolved !== null &&
        (stripExtension(resolved) === targetNoExt ||
          path.join(resolved, 'index') === targetNoExt)
      ) {
        return file;
      }
    }
  }
  return null;
}

function stripExtension(file: string): string {
  return file.replace(/\.(?:[cm]?[jt]s|[jt]sx)$/, '');
}

function toPosix(value: string): string {
  return value.split(path.sep).join('/');
}
