import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { lt, minVersion, valid } from 'semver';
import type { FileEdit, MigrationContext } from './types.js';

/** next/root-params (and its `locale()` export) landed in Next 15.5.0. */
const NEXT_ROOT_PARAMS_MIN_VERSION = '15.5.0';
/**
 * Lower bound for the version gate. The `-0` prerelease tag is deliberate: it
 * lets 15.5.0 prereleases (canaries, rcs) satisfy the gate. Without it semver
 * ranks `15.5.0-canary.3` *below* `15.5.0`, so an installed 15.5 canary/rc; a
 * healthy app that already has next/root-params; would be wrongly gated out and
 * told to upgrade to >= 15.5.
 */
const NEXT_ROOT_PARAMS_MIN_GATE = `${NEXT_ROOT_PARAMS_MIN_VERSION}-0`;

/**
 * Emits the gt-next scaffolding: gt.config.json (merged with any existing
 * one), a loadDictionary loader for the preserved per-locale catalogs, the
 * package.json edit, and deletions of the now-unused next-intl config files.
 * next-intl teardown only happens once no skipped files remain.
 */
export function emitGtFiles(ctx: MigrationContext): FileEdit[] {
  const adapter = ctx.adapter;
  const edits: FileEdit[] = [];
  const fullyMigrated = ctx.skippedFiles.size === 0;

  // Catalog files an adapter synthesized during discovery (e.g. a react-intl
  // default-locale catalog harvested from literal defaultMessages). New files
  // only; flushed here so they respect --dry-run like every other edit.
  if (ctx.catalogs.filesToEmit) {
    edits.push(...ctx.catalogs.filesToEmit);
  }

  // gt.config.json; honor the resolved --config path when the driver set it,
  // otherwise the project root. This one path drives both the merge-read and
  // the write edit below.
  const configPath = ctx.configFile ?? path.join(ctx.cwd, 'gt.config.json');
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

  // loadDictionary.ts; serves the preserved next-intl catalogs per locale.
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
        'a loadDictionary file already exists; verify it serves the migrated catalogs',
    });
  } else {
    // Place inside src/ when the app uses one (matches Next's compilation
    // scope; a root-level loader is detected by gt-next but its webpack
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

  // getLocale.ts / getRegion.ts; restore static (SSG) rendering. The
  // transformed layout resolves the locale from the [locale] route param, but
  // gt-next's server helpers and GTProvider otherwise fall back to
  // request-scoped headers()/cookies(), which forces every route dynamic (ƒ).
  // These two resolvers let withGTConfig (which auto-detects them at the root
  // or under src/) read the locale from next/root-params instead, keeping
  // statically-rendered routes static.
  emitStaticLocaleResolvers(ctx, edits);

  // package.json + next-intl config teardown, only when fully migrated.
  if (fullyMigrated) {
    // Decide config-file retention FIRST. Deleting a module that something
    // still imports breaks the build, so a routing.ts/request.ts kept for a
    // remaining importer also keeps its own `next-intl` import alive. Removing
    // next-intl from package.json in that case would leave that import
    // unresolvable, so the retention decision has to precede the package.json
    // edit, not follow it.
    const deletions = adapter
      .teardownConfigFiles(ctx.routing)
      .filter((file) => fs.existsSync(file));
    // Retention-aware fixed point: a config file kept for a live importer is
    // itself a live importer, so a routing file imported only by a retained
    // request file must also be retained (deleting it would leave the surviving
    // request file with a dangling ./routing import that fails the next build).
    // Loop until stable, each pass ignoring only the candidates still slated for
    // deletion so a just-retained candidate counts as an importer next pass.
    // Two candidates converge in at most two passes; the loop generalizes it.
    const retained: {
      file: string;
      importer: { file: string; exact: boolean };
    }[] = [];
    let deletable = [...deletions];
    let settled = false;
    while (!settled) {
      settled = true;
      // A retention reassigns `deletable` to a filtered copy, so the array this
      // loop iterates (bound at pass start) is never mutated in place.
      const pass = deletable;
      for (const configFile of pass) {
        const importer = findRemainingImporter(ctx, configFile, deletable);
        if (importer) {
          retained.push({ file: configFile, importer });
          deletable = deletable.filter((file) => file !== configFile);
          settled = false;
        }
      }
    }

    const packageJsonPath = path.join(ctx.cwd, 'package.json');
    // Keep the source library only when a RETAINED file actually imports it. A
    // retained routing/request file written as a plain object (no source-library
    // import) must not pin the dependency, and a "still imports it" todo would
    // be false. Use the same specifier regex the driver's out-of-scope scan
    // uses (the adapter's projectUsagePattern), against the on-disk content
    // (retained files are never rewritten by edits).
    const sourceRetainers = retained.filter((entry) => {
      try {
        return adapter.projectUsagePattern.test(
          fs.readFileSync(entry.file, 'utf8')
        );
      } catch {
        // Unreadable retained file: keep the dependency rather than risk
        // stripping one a surviving import still needs.
        return true;
      }
    });
    if (sourceRetainers.length > 0) {
      // A retained config file still imports the source library, so leave the
      // dependency in package.json and explain how to finish by hand.
      const retainedList = sourceRetainers
        .map((entry) => path.relative(ctx.cwd, entry.file))
        .join(', ');
      ctx.todos.push({
        file: packageJsonPath,
        reason: `${adapter.displayName} kept in package.json because ${retainedList} still imports it. After migrating that file off ${adapter.displayName}, remove the dependency by hand.`,
      });
    } else if (fs.existsSync(packageJsonPath)) {
      let pkg: Record<string, Record<string, string>> | null = null;
      try {
        pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      } catch (error) {
        ctx.todos.push({
          file: packageJsonPath,
          reason: `could not be parsed (${String(error)}); remove the ${adapter.displayName} dependency by hand`,
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
          for (const dep of adapter.teardownPackages) {
            if (pkg[section] && pkg[section][dep]) {
              delete pkg[section][dep];
              changed = true;
            }
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

    for (const { file: configFile, importer } of retained) {
      // Deleting a module that something still imports breaks the build;
      // keep it and say so instead.
      ctx.todos.push({
        file: configFile,
        reason: importer.exact
          ? `kept because ${path.relative(ctx.cwd, importer.file)} still imports it; migrate that reference off ${adapter.displayName}, then delete this file`
          : `kept because ${path.relative(ctx.cwd, importer.file)} appears to import it through a path alias; if that specifier is really a third-party package, delete this file yourself`,
      });
    }
    for (const configFile of deletable) {
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
 *    silent no-op; there is nothing to restore);
 *  - the target project's Next must be >= 15.5, since `next/root-params` only
 *    exists there; emitting the import on older Next breaks `next build`;
 *  - the `[locale]` layout must be the root layout, since next/root-params only
 *    exposes `locale` then (a separate root layout above it gets a merge TODO).
 */
function emitStaticLocaleResolvers(
  ctx: MigrationContext,
  edits: FileEdit[]
): void {
  const localeLayout = findLocaleLayout(ctx);
  if (localeLayout.kind === 'none') {
    // No localized route segment to anchor next/root-params on; nothing to
    // restore, so stay silent.
    return;
  }
  if (localeLayout.kind === 'other-segment') {
    const segment = localeLayout.segment;
    // The react-i18next adapter leads with the CORRECTNESS consequence, not the
    // rendering-mode one: with a non-[locale] segment gt-next has no route-param
    // resolver, so it falls back to default-locale detection and every
    // non-default locale renders in the DEFAULT language (the F1 finding). The
    // lost SSG is secondary. (next-intl keeps its original message untouched.)
    if (ctx.adapter?.id === 'react-i18next') {
      ctx.todos.push({
        file: localeLayout.file,
        reason:
          `WRONG LANGUAGE until you rename ${segment} to [locale]: gt-next only ` +
          'reads the route param for a segment named literally [locale], so with ' +
          `${segment} it falls back to default-locale detection and every ` +
          'non-default locale renders in the DEFAULT language. Rename the dynamic ' +
          `segment directory ${segment} to [locale] (updating the imports/links ` +
          'that point at it), then re-run gt migrate so getLocale.ts/getRegion.ts ' +
          'resolve the locale (also restoring static SSG rendering, which is ' +
          'otherwise lost to request-scoped dynamic (ƒ) rendering).',
      });
      // Only a genuine wrong-language risk when there is more than one locale.
      if (ctx.catalogs.locales.length > 1) {
        (ctx.warnings ??= []).push(
          `Localized route segment is ${segment}, not [locale]: every non-default ` +
            `locale (${ctx.catalogs.locales.join(', ')}) will render in the DEFAULT ` +
            `language until you rename ${segment} to [locale] and re-run gt migrate. ` +
            'See the TODO for the full steps.'
        );
      }
      return;
    }
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

  // The [locale] layout itself was left untouched (an unsupported API in the
  // layout), so it never receives GTProvider. Emitting getLocale.ts/getRegion.ts
  // now would be dead weight and would make the report claim "static rendering
  // preserved" when it was not. emitGtFiles runs after every transform pass
  // (source, layouts, config), so ctx.skippedFiles is final here.
  if (ctx.skippedFiles.has(localeLayout.file)) {
    ctx.todos.push({
      file: localeLayout.file,
      reason:
        'static rendering not restored: the [locale] layout needs manual ' +
        'migration first (see its skip reason above); it never receives ' +
        'GTProvider, so getLocale.ts/getRegion.ts would be dead weight. After ' +
        'converting the layout to gt-next, re-run gt migrate to add the ' +
        'resolvers so the locale resolves statically (SSG) from next/root-params.',
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
    'verify it does not read cookies()/headers(); a request-scoped region read forces dynamic rendering'
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
      reason: `a ${base} file already exists; left untouched; ${existingNote}`,
    });
    return;
  }
  const filePath = path.join(ctx.cwd, useSrc ? `src/${base}.ts` : `${base}.ts`);
  edits.push({ path: filePath, kind: 'write', content });
}

/**
 * Result of locating the layout that anchors the localized route segment:
 *  - `locale`: a `[locale]` layout exists (with whether a root layout sits
 *    above it; next/root-params only exposes `locale` when it does not);
 *  - `other-segment`: a dynamic-segment layout exists but is not named
 *    `[locale]` (e.g. `[lang]`), which next/root-params cannot resolve;
 *  - `none`: no dynamic-segment layout at all; nothing to restore.
 */
type LocaleLayout =
  | { kind: 'locale'; file: string; hasRootLayoutAbove: boolean }
  | { kind: 'other-segment'; file: string; segment: string }
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
  // segment (…/[locale]/layout.tsx); not a deeper nested layout under it.
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
  // `[lang]`) still means the app localizes on a route param; flag it so the
  // report explains why static rendering was not restored.
  const otherSegment = layouts.find((file) =>
    isDynamicSegmentDir(path.basename(path.dirname(file)))
  );
  if (otherSegment) {
    return {
      kind: 'other-segment',
      file: otherSegment,
      segment: path.basename(path.dirname(otherSegment)),
    };
  }
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
 * A single dynamic route segment like `[lang]` or `[locale]`; not a catch-all
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
  return version !== null && !lt(version, NEXT_ROOT_PARAMS_MIN_GATE);
}

/**
 * The exact Next version installed for the project, or null. Resolves
 * `next/package.json` the way Node does; walking node_modules from the project
 * root up through its parents; so a next hoisted to a monorepo/workspace root
 * (npm/yarn/pnpm) is still found. A plain `<cwd>/node_modules/next` read would
 * miss it and fall through to the declared range, which fails closed on a
 * healthy hoisted app.
 */
function readInstalledNextVersion(cwd: string): string | null {
  try {
    // `createRequire` needs an absolute base path but the file need not exist;
    // `paths: [cwd]` starts the node_modules walk at the project root.
    const require = createRequire(path.join(cwd, 'package.json'));
    const pkgPath = require.resolve('next/package.json', { paths: [cwd] });
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
 * src/ (or the project root when there is no src/). Other non-package
 * specifiers get a best-effort trailing-segment match (`exact: false`, see
 * matchesAliasedTarget).
 */
function findRemainingImporter(
  ctx: MigrationContext,
  target: string,
  ignoredFiles: string[]
): { file: string; exact: boolean } | null {
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
    // The bare `import\s*` branch catches side-effect imports
    // (`import './routing'`), which have no `from` and no paren but still
    // break at build time if their target is deleted.
    /(?:from\s+|import\s*\(\s*|import\s*|require\s*\(\s*)['"]([^'"]+)['"]/g;

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
      } else if (matchesAliasedTarget(ctx, specifier, targetNoExt)) {
        // Custom tsconfig path aliases (and baseUrl imports) can't be
        // resolved without parsing tsconfig. Err toward keeping the file:
        // a non-package specifier whose trailing path segments match the
        // target counts as an importer. Aliases that don't mirror the file
        // path (single-name or multi-segment scoped ones) are still
        // missed, and those files are deleted with their aliased imports
        // left dangling.
        return { file, exact: false };
      }
      if (
        resolved !== null &&
        (stripExtension(resolved) === targetNoExt ||
          path.join(resolved, 'index') === targetNoExt)
      ) {
        return { file, exact: true };
      }
    }
  }
  return null;
}

/**
 * Best-effort match for import specifiers behind custom path aliases:
 * `#app/i18n/routing` or baseUrl-style `i18n/routing` against a target like
 * `<cwd>/src/i18n/routing.ts`. Installed packages never match (their
 * specifiers are real imports, not aliases), and a candidate needs at least
 * two path segments so bare module names can't collide.
 */
function matchesAliasedTarget(
  ctx: MigrationContext,
  specifier: string,
  targetNoExt: string
): boolean {
  if (!specifier.includes('/')) return false;
  const packageName = specifier.startsWith('@')
    ? specifier.split('/').slice(0, 2).join('/')
    : specifier.split('/')[0];
  if (fs.existsSync(path.join(ctx.cwd, 'node_modules', packageName))) {
    return false;
  }
  const relTarget = toPosix(path.relative(ctx.cwd, targetNoExt));
  const full = stripExtension(specifier);
  const tail = full.split('/').slice(1).join('/');
  for (const candidate of [full, tail]) {
    if (!candidate.includes('/')) continue;
    if (relTarget === candidate || relTarget.endsWith(`/${candidate}`)) {
      return true;
    }
  }
  return false;
}

function stripExtension(file: string): string {
  return file.replace(/\.(?:[cm]?[jt]s|[jt]sx)$/, '');
}

function toPosix(value: string): string {
  return value.split(path.sep).join('/');
}
