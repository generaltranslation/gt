import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import * as t from '@babel/types';
import { lt, minVersion, valid } from 'semver';
import { hasGtProjectConfigured } from '../transforms/gtOptions.js';
import { createMigrateDiagnostic } from '../pipeline/diagnostics.js';
import {
  CONTAINABLE_ENTRY_KINDS,
  appRouteEntryKind,
  couldBeUnresolvedImportTarget,
  declaredDependencyNames,
  installedPackageChecker,
  isPackageSpecifier,
  loadImportAliases,
  resolveImportToProjectFiles,
  routePatternFor,
  specifierTailCandidates,
} from '../pipeline/latentClientCalls.js';
import type { FileEdit, MigrationContext } from '../pipeline/types.js';

/** next/root-params (and its `locale()` export) landed in Next 15.5.0. */
const NEXT_ROOT_PARAMS_MIN_VERSION = '15.5.0';
/**
 * Lower bound for the version gate. The `-0` prerelease tag is deliberate: it
 * lets 15.5.0 prereleases (canaries, rcs) satisfy the gate. Without it semver
 * ranks `15.5.0-canary.3` *below* `15.5.0`, so an installed 15.5 canary/rc (a
 * healthy app that already has next/root-params) would be wrongly gated out and
 * told to upgrade to >= 15.5.
 */
const NEXT_ROOT_PARAMS_MIN_GATE = `${NEXT_ROOT_PARAMS_MIN_VERSION}-0`;

/**
 * Emits the gt-next scaffolding: gt.config.json (merged with any existing
 * one), a loadDictionary loader for the preserved per-locale catalogs, the
 * package.json edit, and deletions of the now-unused next-intl config files.
 * next-intl teardown only happens once no skipped files remain.
 */
/**
 * Pre-write gate for the config merge in emitGtFiles: an existing
 * gt.config.json that cannot be read, parsed, or is not a JSON object must
 * stop the run BEFORE any edit is enqueued. Continuing with `{}` (what the
 * merge would otherwise start from) writes a replacement config, silently
 * discarding settings the parse never saw (projectId, custom files entries,
 * publish options). Returns the diagnostic to fatal with, or null when the
 * config is absent or readable. Resolves the path exactly as emitGtFiles does.
 */
export function checkExistingGtConfig(ctx: MigrationContext): string | null {
  const configPath = ctx.configFile ?? path.join(ctx.cwd, 'gt.config.json');
  if (!fs.existsSync(configPath)) return null;
  let problem: string | null = null;
  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      problem = 'the file is valid JSON but not a JSON object';
    }
  } catch (error) {
    problem = String(error);
  }
  if (!problem) return null;
  return createMigrateDiagnostic({
    severity: 'Error',
    whatHappened: `your existing ${path.relative(ctx.cwd, configPath)} could not be read as a JSON object`,
    why: 'gt migrate merges its settings into the existing config; overwriting an unreadable one would discard settings it cannot see (projectId, custom files entries, publish options)',
    details: problem,
    reassurance: 'Nothing has been written.',
    fix: 'Fix the JSON (or move the file aside to start fresh) and re-run gt migrate.',
  });
}

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
    // Readability was asserted by checkExistingGtConfig before any edit was
    // enqueued; continuing past an unreadable config here would enqueue a
    // write that replaces the user's whole config (projectId, custom files
    // entries, publish settings) with defaults. Re-assert rather than trust
    // the caller: edits are buffered, so a throw leaves the project untouched.
    const parsed: unknown = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(
        `existing ${configPath} is not a JSON object; checkExistingGtConfig must gate emitGtFiles`
      );
    }
    existing = parsed as Record<string, unknown>;
  }
  const existingFiles =
    existing.files && typeof existing.files === 'object'
      ? (existing.files as Record<string, unknown>)
      : {};
  // A hybrid/partially-migrated project may already carry a files.gt entry whose
  // custom input/output paths (and parsingFlags, publish, ...) a current GT
  // workflow relies on. Preserve it rather than clobber it: the migration's
  // default output only fills in what an existing entry omits, matching how the
  // rest of this emit path merges pre-existing config instead of overwriting it.
  const defaultGt = { output: 'public/_gt/[locale].json' };
  const existingGt = existingFiles.gt;
  let gt: unknown;
  if (
    existingGt &&
    typeof existingGt === 'object' &&
    !Array.isArray(existingGt)
  ) {
    gt = { ...defaultGt, ...(existingGt as Record<string, unknown>) };
    ctx.todos.push({
      file: configPath,
      reason:
        'an existing files.gt configuration was preserved (its output/parsingFlags/publish were kept); verify it still points where the migrated catalogs are served',
    });
  } else if (existingGt !== undefined) {
    // Present but not a plain object (pathological): leave it untouched rather
    // than overwrite a shape we do not understand, and flag it.
    gt = existingGt;
    ctx.todos.push({
      file: configPath,
      reason:
        'an existing files.gt value was left unchanged because it is not an object; set it by hand if the migration needs a different output',
    });
  } else {
    gt = defaultGt;
  }
  // gt generate/translate read the dictionary from gt.config.json (they never
  // see the next.config wiring), so record it here too; never clobber a value
  // the user already set (round-9 audit: bare `gt generate` on the emitted
  // tree found no dictionary and wrote empty templates).
  const configDefaultCatalog = toPosix(
    path.relative(
      ctx.cwd,
      path.join(ctx.catalogs.dir, `${ctx.catalogs.defaultLocale}.json`)
    )
  );
  const config = {
    ...existing,
    ...(existing.dictionary === undefined
      ? {
          dictionary: configDefaultCatalog.startsWith('.')
            ? configDefaultCatalog
            : `./${configDefaultCatalog}`,
        }
      : {}),
    defaultLocale: ctx.catalogs.defaultLocale,
    locales: ctx.catalogs.locales,
    files: {
      ...existingFiles,
      gt,
    },
  };
  const configExisted = fs.existsSync(configPath);
  edits.push({
    path: configPath,
    kind: 'write',
    ...(configExisted ? {} : { created: true }),
    content: JSON.stringify(config, null, 2) + '\n',
  });

  // gt-next is wired through withGTConfig in next.config. An app with no
  // config file at all (Next runs fine without one) would otherwise migrate
  // with no dictionary or locale wiring and fail on every locale route at
  // runtime, so create a minimal one.
  if (
    !adapter.nextConfigCandidates.some((candidate) =>
      fs.existsSync(path.join(ctx.cwd, candidate))
    )
  ) {
    const defaultCatalog = toPosix(
      path.relative(
        ctx.cwd,
        path.join(ctx.catalogs.dir, `${ctx.catalogs.defaultLocale}.json`)
      )
    );
    const dictionaryOption = defaultCatalog.startsWith('.')
      ? defaultCatalog
      : `./${defaultCatalog}`;
    const createdConfigPath = path.join(ctx.cwd, 'next.config.ts');
    edits.push({
      path: createdConfigPath,
      kind: 'write',
      created: true,
      content: [
        "import { withGTConfig } from 'gt-next/config';",
        '',
        'export default withGTConfig(',
        '  {},',
        '  {',
        `    dictionary: '${dictionaryOption}',`,
        // Same dictionary-only default as the config transforms: without it,
        // gt-next's I18nCache warns on every run that a remote store needs a
        // projectId; delete the line once a GT project is configured.
        ...(hasGtProjectConfigured(ctx) ? [] : ['    cacheUrl: null,']),
        '  }',
        ');',
        '',
      ].join('\n'),
    });
    ctx.todos.push({
      file: createdConfigPath,
      reason:
        'created (the project had no next.config): withGTConfig wires gt-next dictionary and locale resolution; fold it into your own config if you add one later',
    });
  }

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
      created: true,
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

  // package.json + next-intl config teardown, only when fully migrated. A
  // config whose export shape forced the fallback wrap still has the source
  // library's plugin composed inside it (ctx.nextConfigRetainsPlugin), so the
  // package and its request/routing files must survive even then; the config's
  // own TODO explains how to finish the teardown by hand.
  if (fullyMigrated && ctx.nextConfigRetainsPlugin) {
    ctx.todos.push({
      file: path.join(ctx.cwd, 'package.json'),
      reason: `${adapter.displayName} kept in package.json (and its config files kept on disk) because next.config still composes its plugin inside the wrapped export; migrate that config by hand, then remove the dependency and re-run gt migrate`,
    });
  }
  if (fullyMigrated && !ctx.nextConfigRetainsPlugin) {
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
      importer: NonNullable<ReturnType<typeof findRemainingImporter>>;
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
      // keep it and say so instead. The third case is the honest one for an
      // incomplete graph: gt migrate could not follow the specifier (or could
      // not read the file), so it cannot say this module is unused.
      const importerPath = path.relative(ctx.cwd, importer.file);
      let reason: string;
      if (importer.exact) {
        reason = `kept because ${importerPath} still imports it; migrate that reference off ${adapter.displayName}, then delete this file`;
      } else if (importer.unresolvedSpecifier === undefined) {
        reason = `kept because ${importerPath} appears to import it through a path alias; if that specifier is really a third-party package, delete this file yourself`;
      } else if (importer.unresolvedSpecifier === '') {
        reason = `kept because gt migrate could not read ${importerPath}, so it cannot tell whether that file still imports this one; check it and delete this file yourself if nothing does`;
      } else {
        reason = `kept because ${importerPath} imports '${importer.unresolvedSpecifier}', which gt migrate could not resolve to a file (a tsconfig/bundler path alias it cannot follow) and which could name this one; if that specifier points elsewhere, delete this file yourself`;
      }
      ctx.todos.push({ file: configFile, reason });
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

  // Latent RSC violations (a server module calling a function imported from
  // a 'use client' module) only detonate when a route actually renders on the
  // server: restoring static rendering makes prerender execute the call and
  // fail the build. The hazard is a property of ONE ROUTE'S server graph, so
  // the response is per route: hold exactly the routes that reach a hazard
  // dynamic, emit the resolvers, and let every other route keep static
  // rendering. Only when no such containment exists (see planHazardContainment)
  // do the resolvers get withheld project-wide, which is what round 9 measured
  // as 15 lost SSG route patterns in Sniply.
  if (ctx.latentClientCallHazards && ctx.latentClientCallHazards.length > 0) {
    const hazards = ctx.latentClientCallHazards;
    for (const hazard of hazards) {
      ctx.todos.push({
        file: hazard.caller,
        reason:
          `calls ${hazard.importedName}() imported from the client module ` +
          `${path.relative(ctx.cwd, hazard.clientModule)} while itself being a ` +
          'server module: React throws "Attempted to call ' +
          `${hazard.importedName}() from the server" the moment this route ` +
          'renders on the server. This bug predates the migration: the route ' +
          'already throws this at request time whenever it is rendered on the ' +
          'server. Dynamic rendering did not hide the bug, it only moved the ' +
          'failure from build time to request time. Fix it by marking the ' +
          'caller "use client", or by giving the client module a server-safe ' +
          'entry',
      });
    }
    const plan = planHazardContainment(ctx, localeLayout.file, hazards);
    if (!plan.contained) {
      // No per-route containment: the resolvers stay withheld and every route
      // under the localized segment renders dynamically. The warning must not
      // claim anything about how those routes rendered BEFORE this run (gt
      // migrate never builds the app, so it cannot know); it states the
      // consequence and tells the user where to see it.
      const patterns = localizedRoutePatterns(ctx, localeLayout.file);
      (ctx.warnings ??= []).push(
        `static rendering NOT restored: ${hazards.length} server file(s) call ` +
          'functions imported from client modules, a React Server Components ' +
          'violation this app already carries (see the TODOs). ' +
          'getLocale.ts/getRegion.ts were withheld because prerendering those ' +
          `callers would execute the call and fail the build (${plan.reason}). ` +
          'Consequence: gt-next resolves the locale from request-scoped ' +
          'headers/cookies instead, so every route under [locale] renders ' +
          'dynamically (ƒ), including any route that `next build` previously ' +
          'listed as ● (SSG)' +
          (patterns.length > 0 ? `: ${patterns.join(', ')}` : '') +
          '. Compare the route table from your last pre-migration build ' +
          'against the next one to see which routes changed. Fix the listed ' +
          'callers and re-run gt migrate to restore static rendering.'
      );
      ctx.todos.push({
        file: localeLayout.file,
        reason:
          'static rendering not restored: see the latent client-call hazards ' +
          `above; ${plan.reason}, and prerendering would execute those calls ` +
          'and fail the build. After fixing them, re-run gt migrate to add ' +
          'getLocale.ts/getRegion.ts',
      });
      return;
    }
    applyHazardContainment(ctx, edits, plan.targets);
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

/** One route file to hold dynamic, with why (for the report) and its new content. */
type ContainmentTarget = {
  /** the route file the `dynamic` export goes into */
  entry: string;
  /** route pattern as `next build` prints it (`/[locale]/about`) */
  pattern: string;
  /** the hazard(s) this route reaches, each with its import chain */
  reasons: { hazard: LatentHazard; chain: string[] }[];
  /** new file content, or null when it already exports force-dynamic */
  content: string | null;
};

type LatentHazard = NonNullable<
  MigrationContext['latentClientCallHazards']
>[number];

/**
 * Decides how to keep a latent client call from crashing prerender.
 *
 * Containment is per route: `export const dynamic = "force-dynamic"` on exactly
 * the route segments whose server graph reaches a hazard. That is safe against
 * the regression this replaced (round 9: one hazard withheld the resolvers and
 * cost Sniply 15 SSG route patterns), because holding these routes dynamic
 * cannot take static rendering away from a route that had it: prerendering a
 * route that reaches the hazard executes the call and fails the build, so no
 * build that succeeded could have prerendered it.
 *
 * Containment is impossible when the reaching route file cannot carry the
 * export, or when writing it would demote the whole localized app anyway (the
 * hazard sits in the [locale] layout, whose subtree is every localized route).
 * The caller then withholds the resolvers project-wide and reports it.
 */
function planHazardContainment(
  ctx: MigrationContext,
  localeLayoutFile: string,
  hazards: LatentHazard[]
):
  | { contained: true; targets: ContainmentTarget[] }
  | { contained: false; reason: string } {
  const relative = (file: string) => path.relative(ctx.cwd, file);
  const localeDir = path.dirname(localeLayoutFile);
  const targets = new Map<string, ContainmentTarget>();
  for (const hazard of hazards) {
    // No reaching entries means the detector could not place this file in any
    // route's graph with confidence (an import specifier it could not
    // resolve), so there is no route to contain.
    if (!hazard.reachedFrom || hazard.reachedFrom.length === 0) {
      return {
        contained: false,
        reason:
          'gt migrate could not determine which routes render ' +
          relative(hazard.caller),
      };
    }
    // The routes it DID find are a lower bound: an unresolved specifier could
    // name this file or one that imports it, so another route may render the
    // same hazard. Containing only the routes we can see would leave that one
    // prerendered with the hazard in its graph, so withhold project-wide.
    if (hazard.reachSetIncomplete) {
      return {
        contained: false,
        reason:
          `an import of ${relative(hazard.reachSetIncomplete)} could not be ` +
          'resolved (a tsconfig/bundler path alias, or a specifier gt migrate ' +
          `could not map to a file), so the set of routes that render ` +
          `${relative(hazard.caller)} is unknown`,
      };
    }
    for (const { entry, chain } of hazard.reachedFrom) {
      const existing = targets.get(entry);
      if (existing) {
        existing.reasons.push({ hazard, chain });
        continue;
      }
      const kind = appRouteEntryKind(entry, ctx.cwd);
      if (!kind || !CONTAINABLE_ENTRY_KINDS.has(kind)) {
        return {
          contained: false,
          reason:
            `${relative(hazard.caller)} renders through ${relative(entry)}, ` +
            'which Next.js does not read route segment config (export const ' +
            'dynamic) from',
        };
      }
      const entryDir = path.dirname(entry);
      if (
        kind === 'layout' &&
        (entryDir === localeDir || isStrictAncestorDir(entryDir, localeDir))
      ) {
        return {
          contained: false,
          reason:
            `${relative(hazard.caller)} renders through ${relative(entry)}, ` +
            'a layout whose subtree is the whole localized app, so holding it ' +
            'dynamic would demote every route anyway',
        };
      }
      if (ctx.skippedFiles.has(entry)) {
        return {
          contained: false,
          reason:
            `${relative(hazard.caller)} renders through ${relative(entry)}, ` +
            'which this run left untouched for manual migration',
        };
      }
      const source = pendingOrDiskContent(ctx, entry);
      if (source === null) {
        return {
          contained: false,
          reason: `gt migrate could not read ${relative(entry)}`,
        };
      }
      const insertion = planForceDynamicExport(source);
      if (insertion.kind === 'conflict') {
        return {
          contained: false,
          reason:
            `${relative(entry)} renders ${relative(hazard.caller)} but ` +
            insertion.detail,
        };
      }
      targets.set(entry, {
        entry,
        pattern: routePatternFor(entry, ctx.cwd) ?? relative(entry),
        reasons: [{ hazard, chain }],
        content: insertion.kind === 'already' ? null : insertion.content,
      });
    }
  }
  return { contained: true, targets: [...targets.values()] };
}

/**
 * Writes the containment: the `dynamic` export into each reaching route file
 * (folded into that file's pending edit when the transform already rewrote it,
 * so one write does not clobber the other), a TODO per contained route naming
 * the hazard chain, and one warning that says which routes were held dynamic
 * and that the rest keep static rendering. Says nothing about how the app
 * rendered before this run, which gt migrate never measures.
 */
function applyHazardContainment(
  ctx: MigrationContext,
  edits: FileEdit[],
  targets: ContainmentTarget[]
): void {
  const relative = (file: string) => path.relative(ctx.cwd, file);
  for (const target of targets) {
    if (target.content !== null) {
      // Last write wins on disk, so fold into the LAST pending edit.
      const pending = [...ctx.edits]
        .reverse()
        .find((edit) => edit.kind === 'write' && edit.path === target.entry);
      if (pending) pending.content = target.content;
      else {
        edits.push({
          path: target.entry,
          kind: 'write',
          content: target.content,
        });
      }
    }
    const chains = target.reasons
      .map(
        ({ hazard, chain }) =>
          `${chain.map(relative).join(' -> ')} calls ` +
          `${hazard.importedName}() from the client module ` +
          relative(hazard.clientModule)
      )
      .join('; ');
    ctx.todos.push({
      file: target.entry,
      reason:
        (target.content === null
          ? 'held dynamic (it already exports dynamic = "force-dynamic")'
          : 'held dynamic (gt migrate added export const dynamic = ' +
            '"force-dynamic")') +
        `: prerendering ${target.pattern} would execute a client-module call ` +
        `on the server and fail the build. Chain: ${chains}. Fix that call, ` +
        'then delete the dynamic export to get static rendering (SSG) back on ' +
        'this route',
    });
  }
  // "gt migrate added the export" is only true for the routes where this run
  // planned an insertion. A route that already carried
  // `dynamic = "force-dynamic"` was left alone (the planner returned 'already',
  // which is what target.content === null records), and on a re-run over an
  // already-migrated tree that is EVERY route: claiming credit for writing them
  // then, under a dry-run header that says nothing was written, is a past-tense
  // action this run did not take (the round-9 audit finding). Each group gets its
  // own verb; the label is per group, so no route moves out of the warning.
  const label = (group: ContainmentTarget[]) =>
    group
      .map((target) => `${target.pattern} (${relative(target.entry)})`)
      .join(', ');
  const inserted = targets.filter((target) => target.content !== null);
  const alreadyPresent = targets.filter((target) => target.content === null);
  const containment = [
    inserted.length > 0
      ? // Present tense so the sentence is true in both modes: a --dry-run
        // report says "nothing written" in its own header, and past-tense credit
        // for a write that has not happened is the same defect as crediting an
        // insertion into a file this run never touched.
        'gt migrate adds `export const dynamic = "force-dynamic"` to ' +
        `${label(inserted)}.`
      : null,
    alreadyPresent.length > 0
      ? '`export const dynamic = "force-dynamic"` is already present (kept as ' +
        `is, not written by this run) on ${label(alreadyPresent)}.`
      : null,
  ]
    .filter((clause): clause is string => clause !== null)
    .join(' ');
  (ctx.warnings ??= []).push(
    `${targets.length} route(s) held dynamic (ƒ) to protect the build: ` +
      'their server render reaches a function imported from a client module, ' +
      'a React Server Components violation this app already carries (see the ' +
      'TODOs). Prerendering them would execute that call and fail the build. ' +
      `${containment} ` +
      'This takes static rendering away from no route that had it: no build ' +
      'that succeeded could have prerendered a route whose render fails. ' +
      'Every other route keeps static rendering (SSG) through ' +
      'getLocale.ts/getRegion.ts. Fix the listed calls, delete the dynamic ' +
      'export(s), and re-run your build to confirm.'
  );
}

/**
 * The route patterns under the localized segment, for the report's
 * withholding warning (every one of them renders dynamically once the
 * resolvers are withheld). Long lists are truncated so the warning stays
 * readable, and the truncation says so rather than silently cutting off.
 */
function localizedRoutePatterns(
  ctx: MigrationContext,
  localeLayoutFile: string
): string[] {
  const localeDir = path.dirname(localeLayoutFile) + path.sep;
  const patterns = new Set<string>();
  for (const file of ctx.projectFiles ?? []) {
    if (!file.startsWith(localeDir)) continue;
    if (appRouteEntryKind(file, ctx.cwd) !== 'page') continue;
    const pattern = routePatternFor(file, ctx.cwd);
    if (pattern) patterns.add(pattern);
  }
  const sorted = [...patterns].sort();
  const limit = 12;
  return sorted.length > limit
    ? [...sorted.slice(0, limit), `and ${sorted.length - limit} more`]
    : sorted;
}

/** A file's content as it will land on disk: its pending edit, else disk. */
function pendingOrDiskContent(
  ctx: MigrationContext,
  file: string
): string | null {
  const pending = [...ctx.edits]
    .reverse()
    .find((edit) => edit.kind === 'write' && edit.path === file);
  if (pending) return pending.content ?? '';
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Plans the `export const dynamic = "force-dynamic"` insertion into a route
 * file: after its imports (and after any directive prologue, so a leading
 * 'use client'/'use server' keeps its position). Re-running gt migrate must not
 * stack duplicate declarations, so an existing `dynamic` export short-circuits:
 * one already set to force-dynamic is a no-op, and any OTHER `dynamic` export
 * is a conflict this must not overwrite (the user chose that rendering mode).
 */
function planForceDynamicExport(
  source: string
):
  | { kind: 'insert'; content: string }
  | { kind: 'already' }
  | { kind: 'conflict'; detail: string } {
  let ast: t.File;
  try {
    ast = parse(source, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });
  } catch {
    return { kind: 'conflict', detail: 'gt migrate could not parse it' };
  }
  for (const statement of ast.program.body) {
    if (!t.isExportNamedDeclaration(statement)) continue;
    const declaration = statement.declaration;
    if (t.isVariableDeclaration(declaration)) {
      for (const declarator of declaration.declarations) {
        if (
          !t.isIdentifier(declarator.id) ||
          declarator.id.name !== 'dynamic'
        ) {
          continue;
        }
        if (
          t.isStringLiteral(declarator.init) &&
          declarator.init.value === 'force-dynamic'
        ) {
          return { kind: 'already' };
        }
        return {
          kind: 'conflict',
          detail: t.isStringLiteral(declarator.init)
            ? `it already exports dynamic = "${declarator.init.value}"`
            : 'it already exports a `dynamic` route segment config',
        };
      }
    }
    for (const specifier of statement.specifiers) {
      if (!t.isExportSpecifier(specifier)) continue;
      const exported = t.isIdentifier(specifier.exported)
        ? specifier.exported.name
        : specifier.exported.value;
      if (exported === 'dynamic') {
        return {
          kind: 'conflict',
          detail: 'it already exports a `dynamic` route segment config',
        };
      }
    }
  }
  // Insert after the last leading import (and never before a directive, which
  // must stay the first statement in the file).
  let offset = 0;
  for (const directive of ast.program.directives) {
    offset = Math.max(offset, directive.end ?? 0);
  }
  for (const statement of ast.program.body) {
    if (t.isImportDeclaration(statement)) {
      offset = Math.max(offset, statement.end ?? 0);
    }
  }
  const block = [
    '// Added by gt migrate: this route renders a call to a client-module',
    '// function on the server, which crashes prerendering. See the TODOs in',
    '// gt-migrate-report.md; delete this once that call is fixed.',
    'export const dynamic = "force-dynamic";',
  ].join('\n');
  const head = source.slice(0, offset);
  const tail = source.slice(offset);
  const glue = tail.startsWith('\n') ? '' : '\n';
  return {
    kind: 'insert',
    content: head
      ? `${head}\n\n${block}${glue}${tail}`
      : `${block}\n${glue}${tail}`,
  };
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
  edits.push({ path: filePath, kind: 'write', created: true, content });
}

/**
 * Result of locating the layout that anchors the localized route segment:
 *  - `locale`: a `[locale]` layout exists (with whether a root layout sits
 *    above it; next/root-params only exposes `locale` when it does not);
 *  - `other-segment`: a dynamic-segment layout exists but is not named
 *    `[locale]` (e.g. `[lang]`), which next/root-params cannot resolve;
 *  - `none`: no dynamic-segment layout at all; nothing to restore.
 */
export type LocaleLayout =
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
export function findLocaleLayout(ctx: MigrationContext): LocaleLayout {
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
export function supportsRootParams(cwd: string): boolean {
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
 *
 * The answer gates a DELETE, so "no importer found" has to mean the graph was
 * complete enough to say so. Two ways it is not, both of which retain the file
 * instead (`unresolvedSpecifier` set, for the report):
 *  - a local-looking specifier that resolves to no project file at all and
 *    whose tail could name the target: a tsconfig `paths` alias that does not
 *    mirror the file path ('#config' -> src/i18n/routing.ts) is invisible to
 *    the heuristics above, and deleting the target leaves it dangling;
 *  - a project file this process cannot read: it may hold the import, and
 *    every other read in this module already fails toward retention.
 */
function findRemainingImporter(
  ctx: MigrationContext,
  target: string,
  ignoredFiles: string[]
): { file: string; exact: boolean; unresolvedSpecifier?: string } | null {
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

  const projectFiles = ctx.projectFiles ?? ctx.sourceFiles ?? [];
  const fileSet = new Set(projectFiles);
  const declaredPackages = declaredDependencyNames(ctx.cwd);
  const isInstalledPackage = installedPackageChecker(ctx.cwd);
  const aliases = loadImportAliases(ctx.cwd);
  // Same "could an unresolved specifier name this file?" question the hazard
  // detector asks (couldBeUnresolvedImportTarget), so both stages treat an
  // incomplete graph identically. Each tail remembers the file and specifier
  // that produced it, for the report.
  const unresolvedTails = new Map<
    string,
    { file: string; specifier: string }
  >();
  let unreadable: string | null = null;

  for (const file of projectFiles) {
    if (ignoredFiles.includes(file)) continue;
    let content: string;
    const pending = pendingEdits.get(file);
    if (pending !== undefined) {
      content = pending;
    } else {
      try {
        content = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      } catch {
        // Unreadable: it could be the importer, and an unguarded read here
        // aborted the whole run. Retain rather than delete on faith.
        unreadable ??= file;
        continue;
      }
    }
    for (const match of content.matchAll(specifierPattern)) {
      const specifier = match[1];
      let resolved: string | null = null;
      if (specifier.startsWith('.')) {
        resolved = path.resolve(path.dirname(file), specifier);
      } else if (specifier.startsWith('@/') || specifier.startsWith('~/')) {
        resolved = path.join(aliasRoot, specifier.slice(2));
      } else {
        // Every other non-relative specifier goes through the pipeline's
        // resolver, which reads the project's own tsconfig/jsconfig `paths`:
        // an alias that does not mirror its target's path ('#config' ->
        // src/i18n/routing.ts) is invisible to the tail heuristics, and the
        // file was deleted with that import left dangling.
        const candidates = resolveImportToProjectFiles(
          specifier,
          path.dirname(file),
          fileSet,
          projectFiles,
          aliases
        );
        if (
          candidates.some(
            (candidate) => stripExtension(candidate) === targetNoExt
          )
        ) {
          return { file, exact: true };
        }
        if (candidates.length === 0) {
          if (matchesAliasedTarget(ctx, specifier, targetNoExt)) {
            // Err toward keeping the file: a non-package specifier whose
            // trailing path segments match the target counts as an importer.
            return { file, exact: false };
          }
          if (
            !isPackageSpecifier(specifier, declaredPackages) &&
            !isInstalledPackage(specifier)
          ) {
            // Local-looking and unresolvable by every route above: remember
            // what it could have named. Checked against the target after the
            // whole project is scanned, so a real importer still wins.
            for (const tail of specifierTailCandidates(specifier)) {
              if (!unresolvedTails.has(tail)) {
                unresolvedTails.set(tail, { file, specifier });
              }
            }
          }
        }
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
  // No file was found importing the target. That is only a real acquittal
  // while the scan could read every file and follow every local specifier.
  if (couldBeUnresolvedImportTarget(target, new Set(unresolvedTails.keys()))) {
    const base = path.basename(targetNoExt);
    const hit =
      unresolvedTails.get(base) ??
      unresolvedTails.get(path.basename(path.dirname(targetNoExt)))!;
    return { file: hit.file, exact: false, unresolvedSpecifier: hit.specifier };
  }
  if (unreadable !== null) {
    return { file: unreadable, exact: false, unresolvedSpecifier: '' };
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
