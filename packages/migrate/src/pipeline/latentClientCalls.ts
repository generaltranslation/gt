import fs from 'node:fs';
import path from 'node:path';
import { isBuiltin } from 'node:module';
import { parse } from '@babel/parser';
import * as t from '@babel/types';
import { moduleSpecifierMatches } from '../fs/moduleSpecifiers.js';
import type { MigrationContext } from './types.js';

const EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js'];

/**
 * Test-ish files are not routes; prerendering never executes them, so a
 * client call there is a test concern (reported through the test-file
 * handling), not a build hazard. Shared with the driver, which routes these
 * files into the explicit tests-need-manual-migration stage.
 *
 * Match it against the path RELATIVE to the project root (isTestFilePath),
 * never the absolute one: the directories above the project belong to the
 * environment, not the app (a CI workspace at /builds/e2e/, a checkout under
 * ~/tests/), and matching those reclassified every file in the project as a
 * test file.
 *
 * The setup-file alternatives cover the conventions a runner wires by CONFIG
 * rather than by import (`setupFiles`/`setupFilesAfterEach`), which is where a
 * suite's whole i18n mock usually lives: vitest.setup.ts, jest-setup.js,
 * src/setupTests.ts (CRA/jest), test-setup.ts.
 */
export const TEST_FILE_PATH =
  /(^|\/)(__tests__|__mocks__|tests?|e2e)\/|\.(test|spec)\.[cm]?[jt]sx?$|(^|\/)((vitest|jest)[.-]setup|setup-?[Tt]ests?|test-?[Ss]etup)\.[cm]?[jt]sx?$/;

/**
 * Whether a project file is test-ish, judged on its project-relative path (see
 * TEST_FILE_PATH). Every consumer must go through this: passing an absolute
 * path lets a directory the user does not control decide the classification.
 */
export function isTestFilePath(file: string, cwd: string): boolean {
  return TEST_FILE_PATH.test(toPosix(path.relative(cwd, file)));
}

/**
 * App Router files Next.js renders as a route segment of its own. These are
 * the entry points of the server component graph: nothing imports them, the
 * framework renders them, so reachability has to start here.
 */
const ROUTE_ENTRY_FILE = /^(page|layout|template|default|route)\.[cm]?[jt]sx?$/;

/**
 * The route-segment files Next.js documents as reading route segment config
 * (`export const dynamic`): layout.js, page.js, route.js. A hazard reachable
 * only through a `template`/`default` file therefore cannot be contained by
 * writing that export, so the emit phase falls back to withholding.
 */
export const CONTAINABLE_ENTRY_KINDS = new Set(['page', 'layout', 'route']);

/**
 * Which App Router entry a file is (`page`, `layout`, `template`, `default`,
 * `route`), or null when it is not one. Next.js only reads an app directory at
 * `app/` or `src/app/`, so the path is anchored: a component named page.tsx
 * outside those trees is an ordinary module, not a route.
 */
export function appRouteEntryKind(file: string, cwd: string): string | null {
  const relative = toPosix(path.relative(cwd, file));
  if (!/^(?:src\/)?app\//.test(relative)) return null;
  const match = ROUTE_ENTRY_FILE.exec(path.basename(file));
  return match ? match[1] : null;
}

/**
 * The route pattern an App Router entry file serves, as `next build` prints it
 * (`src/app/[locale]/about/page.tsx` -> `/[locale]/about`). Route groups
 * (`(marketing)`) and parallel-route slots (`@modal`) are path-only segments
 * and drop out, matching Next's own output. Null for a file outside app/.
 */
export function routePatternFor(file: string, cwd: string): string | null {
  const relative = toPosix(path.relative(cwd, file));
  const match = /^(?:src\/)?app\/(.*)$/.exec(relative);
  if (!match) return null;
  const segments = match[1]
    .split('/')
    .slice(0, -1)
    .filter((segment) => !/^\(.*\)$/.test(segment) && !segment.startsWith('@'));
  return `/${segments.join('/')}`;
}

/**
 * Finds latent React Server Components violations the app already carries:
 * a server module (no 'use client' directive) that CALLS a function imported
 * from a client module (e.g. a server page calling a useLocalizedLabel()
 * hook exported by a 'use client' file). Rendering such a route on the
 * server throws "Attempted to call <fn>() from the server", but a baseline
 * app whose routes all render dynamically may never hit it at build time.
 * gt migrate's static-rendering restoration would make prerender execute the
 * call and fail the build (the round-7 Sniply /about, /terms, /privacy
 * failures), so the emit phase contains the routes that reach one (or, when
 * containment is impossible, withholds the locale resolvers) and the report
 * names every hazard.
 *
 * Only direct calls count: rendering a client COMPONENT from a server file
 * (<ClientThing />) and passing a client function around as a reference are
 * both legal composition and must not trip this.
 *
 * "Server module" is a property of the import graph, not of one file's
 * directive (the round-9 finding). A file with no directive that is only ever
 * imported from 'use client' modules IS a client component under RSC, and a
 * file nothing imports at all is in no route's graph; neither can crash a
 * server render, so neither is a hazard. Only files reachable from an app
 * route entry through non-client imports are, and each hazard records the
 * entries that reach it so the emit phase can contain exactly those routes.
 */
export function detectLatentClientCallHazards(ctx: MigrationContext): void {
  const projectFiles = ctx.projectFiles ?? [];
  if (projectFiles.length === 0) return;
  const fileSet = new Set(projectFiles);
  const contentCache = new Map<string, string | null>();
  // A file that cannot be read contributes no edges, so the whole graph is a
  // lower bound while one exists (round-10 A8). Recorded on
  // ctx.unreadableFiles, the one owner of "this run could not see inside that
  // file": the teardown scan and the report already read it, and the
  // containment planner refuses per-route containment on it.
  const unreadableFiles = new Set<string>();
  const readFile = (file: string): string | null => {
    if (!contentCache.has(file)) {
      try {
        contentCache.set(file, fs.readFileSync(file, 'utf8'));
      } catch {
        contentCache.set(file, null);
        unreadableFiles.add(file);
      }
    }
    return contentCache.get(file) ?? null;
  };

  // 1. Client modules: files with a real 'use client' directive.
  const clientModules = new Set<string>();
  for (const file of projectFiles) {
    const code = readFile(file);
    if (!code || !code.includes('use client')) continue;
    try {
      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });
      if (
        ast.program.directives.some(
          (directive) => directive.value.value === 'use client'
        )
      ) {
        clientModules.add(file);
      }
    } catch {
      // unparseable: the transform passes own that diagnosis
    }
  }
  if (clientModules.size === 0) return;

  // Names an importer of a client module must mention somewhere in its source.
  // A barrel at <dir>/index.tsx is imported as '<dir>' ('@/widgets/Widget',
  // '../widgets/Widget'), so for those the DIRECTORY name is the mention, and
  // keying only on the basename ('index') skipped every such route before it
  // was ever parsed (the round-9 F1 finding: a client barrel acquitted itself).
  const clientMentionNames = new Set<string>();
  for (const file of clientModules) {
    const base = path.basename(file).replace(/\.[^.]+$/, '');
    clientMentionNames.add(base);
    if (base === 'index') {
      clientMentionNames.add(path.basename(path.dirname(file)));
    }
  }

  // 2. Import graph + the server render graph reachable from route entries.
  const graph = buildImportGraph(ctx, projectFiles, fileSet, readFile);
  const aliases = graph.aliases;
  const serverGraph = collectServerGraph(
    ctx,
    projectFiles,
    graph.imports,
    clientModules
  );
  // Reverse edges, for the completeness question below.
  const importersOf = new Map<string, string[]>();
  for (const [file, targets] of graph.imports) {
    for (const target of targets) {
      const list = importersOf.get(target);
      if (list) list.push(file);
      else importersOf.set(target, [file]);
    }
  }

  // 3. Server modules calling functions imported from those client modules.
  const hazards: NonNullable<MigrationContext['latentClientCallHazards']> = [];
  for (const file of projectFiles) {
    if (clientModules.has(file)) continue;
    if (isTestFilePath(file, ctx.cwd)) continue;
    const code = readFile(file);
    if (!code) continue;
    // Cheap prefilter: an import of a client module must at least mention the
    // name the importer would write for it (see clientMentionNames).
    let mentions = false;
    for (const name of clientMentionNames) {
      if (code.includes(name)) {
        mentions = true;
        break;
      }
    }
    if (!mentions) continue;
    let ast: t.File;
    try {
      ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });
    } catch {
      continue;
    }
    // local binding -> { exported name, client module } for named/default
    // imports; namespace locals resolve per-member at the call site.
    const callBindings = new Map<
      string,
      { importedName: string; clientModule: string }
    >();
    const namespaceBindings = new Map<string, string>();
    for (const statement of ast.program.body) {
      if (!t.isImportDeclaration(statement)) continue;
      if (statement.importKind === 'type') continue;
      const candidates = resolveImportToProjectFiles(
        statement.source.value,
        path.dirname(file),
        fileSet,
        projectFiles,
        aliases
      );
      // Alias suffix matching can be ambiguous (a/i18n/labels.ts and
      // b/i18n/labels.ts both end in the specifier's tail). When ANY
      // candidate is a client module, treat the import as client: the wrong
      // direction here reports a hazard with a named reason, while the
      // opposite error ships a prerender crash.
      const resolved = candidates.find((candidate) =>
        clientModules.has(candidate)
      );
      if (!resolved) continue;
      for (const specifier of statement.specifiers) {
        if (t.isImportSpecifier(specifier)) {
          if (specifier.importKind === 'type') continue;
          const importedName = t.isIdentifier(specifier.imported)
            ? specifier.imported.name
            : specifier.imported.value;
          callBindings.set(specifier.local.name, {
            importedName,
            clientModule: resolved,
          });
        } else if (t.isImportDefaultSpecifier(specifier)) {
          callBindings.set(specifier.local.name, {
            importedName: 'default',
            clientModule: resolved,
          });
        } else if (t.isImportNamespaceSpecifier(specifier)) {
          namespaceBindings.set(specifier.local.name, resolved);
        }
      }
    }
    if (callBindings.size === 0 && namespaceBindings.size === 0) continue;

    let hazard: { importedName: string; clientModule: string } | null = null;
    walkNodes(ast, (node) => {
      if (hazard || !t.isCallExpression(node)) return;
      const callee = node.callee;
      if (t.isIdentifier(callee)) {
        const binding = callBindings.get(callee.name);
        if (binding) hazard = binding;
        return;
      }
      if (
        t.isMemberExpression(callee) &&
        !callee.computed &&
        t.isIdentifier(callee.object) &&
        t.isIdentifier(callee.property)
      ) {
        const module = namespaceBindings.get(callee.object.name);
        if (module) {
          hazard = { importedName: callee.property.name, clientModule: module };
        }
      }
    });
    if (hazard === null) continue;
    const found: { importedName: string; clientModule: string } = hazard;

    // Graph placement decides whether this call can ever run on the server.
    if (serverGraph.has(file)) {
      // reachingRouteEntries walks RESOLVED edges only, so its answer is a
      // lower bound whenever an unresolved specifier could name this file or
      // anything that imports it: another route could reach the same hazard
      // through the edge we never saw. Per-route containment on a lower bound
      // would leave that route prerendered with the hazard in its graph (the
      // round-9 F2 regression), so the completeness question is recorded here
      // and the emit phase falls back to the project-wide withhold.
      const unresolvedReacher = unresolvedReachPath(
        file,
        importersOf,
        graph.unresolvedTails
      );
      hazards.push({
        caller: file,
        importedName: found.importedName,
        clientModule: found.clientModule,
        reachedFrom: reachingRouteEntries(
          ctx,
          file,
          graph.imports,
          serverGraph
        ),
        ...(unresolvedReacher === null
          ? {}
          : { reachSetIncomplete: unresolvedReacher }),
      });
      continue;
    }
    // Outside the server graph. That is only a real acquittal if the graph is
    // complete for this file: an import specifier we could not resolve (a
    // tsconfig `paths` alias, a webpack alias) could be the server importer we
    // never saw, and so could a file we could not read (round-10 A8). When
    // either could plausibly point here, keep the hazard with no reaching
    // entries, which makes the emit phase withhold globally the way it always
    // did rather than emit a build that crashes on prerender.
    if (
      unreadableFiles.size > 0 ||
      couldBeUnresolvedImportTarget(file, graph.unresolvedTails)
    ) {
      hazards.push({
        caller: file,
        importedName: found.importedName,
        clientModule: found.clientModule,
        reachedFrom: [],
      });
    }
  }
  if (unreadableFiles.size > 0) {
    const known = new Set(ctx.unreadableFiles ?? []);
    for (const file of unreadableFiles) {
      if (!known.has(file)) (ctx.unreadableFiles ??= []).push(file);
    }
  }
  if (hazards.length > 0) {
    ctx.latentClientCallHazards = hazards;
  }
}

/**
 * The app's module-level import graph, plus the specifiers that looked local
 * but resolved to no project file (see couldBeUnresolvedImportTarget).
 *
 * Specifiers are scanned with regexes rather than parsed: this runs over EVERY
 * project file (not just the i18n ones), re-exports and dynamic imports carry
 * graph edges too, and an over-matched specifier (one inside a comment or a
 * string) only ever adds an edge. Extra edges make the server graph larger,
 * which keeps more hazards, which is the safe direction; a missed edge is the
 * one that ships a crashing build.
 */
function buildImportGraph(
  ctx: MigrationContext,
  projectFiles: string[],
  fileSet: Set<string>,
  readFile: (file: string) => string | null
): {
  imports: Map<string, string[]>;
  unresolvedTails: Set<string>;
  aliases: ImportAliases;
} {
  const declaredPackages = declaredDependencyNames(ctx.cwd);
  const isInstalledPackage = installedPackageChecker(ctx.cwd);
  const aliases = loadImportAliases(ctx.cwd);
  const imports = new Map<string, string[]>();
  const unresolvedTails = new Set<string>();
  for (const file of projectFiles) {
    const code = readFile(file);
    if (!code) continue;
    const specifiers = new Set<string>();
    // Prose in a comment can spell `from "..."`; those are not imports, and
    // an unfollowable one would widen the hazard reach set (see
    // isPlausibleModuleSpecifier).
    for (const specifier of moduleSpecifierMatches(code)) {
      if (isPlausibleModuleSpecifier(specifier)) specifiers.add(specifier);
    }
    const targets = new Set<string>();
    for (const specifier of specifiers) {
      const resolved = resolveImportToProjectFiles(
        specifier,
        path.dirname(file),
        fileSet,
        projectFiles,
        aliases
      );
      if (resolved.length > 0) {
        for (const target of resolved) {
          if (target !== file) targets.add(target);
        }
        continue;
      }
      if (
        isPackageSpecifier(specifier, declaredPackages) ||
        isInstalledPackage(specifier)
      ) {
        continue;
      }
      // Local-looking and unresolved: remember what it could have pointed at.
      for (const tail of specifierTailCandidates(specifier)) {
        unresolvedTails.add(tail);
      }
    }
    imports.set(file, [...targets]);
  }
  return { imports, unresolvedTails, aliases };
}

/**
 * Every project file React can render on the SERVER: the transitive closure of
 * the app's route entries (page/layout/template/default/route) over imports,
 * stopping at each 'use client' boundary. Entry files that are themselves
 * client modules are not roots, so a component imported only from client pages
 * never enters the closure (it is a client component, and React renders it on
 * the client).
 */
function collectServerGraph(
  ctx: MigrationContext,
  projectFiles: string[],
  imports: Map<string, string[]>,
  clientModules: Set<string>
): Set<string> {
  const serverGraph = new Set<string>();
  const queue = projectFiles.filter(
    (file) =>
      !clientModules.has(file) && appRouteEntryKind(file, ctx.cwd) !== null
  );
  for (const entry of queue) serverGraph.add(entry);
  // Breadth-first over a visited set, so import cycles terminate.
  for (let index = 0; index < queue.length; index += 1) {
    for (const target of imports.get(queue[index]) ?? []) {
      if (clientModules.has(target) || serverGraph.has(target)) continue;
      serverGraph.add(target);
      queue.push(target);
    }
  }
  return serverGraph;
}

/**
 * The route entries whose server render reaches `hazardFile`, each with the
 * import chain that gets there (entry first, hazard last) so the report can
 * show the user why a route was contained. Walks the import graph BACKWARDS
 * from the hazard, staying inside the server graph (which already excludes
 * client modules and everything only they import).
 */
function reachingRouteEntries(
  ctx: MigrationContext,
  hazardFile: string,
  imports: Map<string, string[]>,
  serverGraph: Set<string>
): { entry: string; chain: string[] }[] {
  const importers = new Map<string, string[]>();
  for (const [file, targets] of imports) {
    if (!serverGraph.has(file)) continue;
    for (const target of targets) {
      if (!serverGraph.has(target)) continue;
      const list = importers.get(target);
      if (list) list.push(file);
      else importers.set(target, [file]);
    }
  }
  // Shortest-path BFS: `parent` doubles as the visited set.
  const parent = new Map<string, string | null>([[hazardFile, null]]);
  const queue = [hazardFile];
  const reached: { entry: string; chain: string[] }[] = [];
  for (let index = 0; index < queue.length; index += 1) {
    const file = queue[index];
    if (appRouteEntryKind(file, ctx.cwd) !== null) {
      const chain: string[] = [];
      for (let step: string | null = file; step; step = parent.get(step)!) {
        chain.push(step);
      }
      reached.push({ entry: file, chain });
    }
    for (const importer of importers.get(file) ?? []) {
      if (parent.has(importer)) continue;
      parent.set(importer, file);
      queue.push(importer);
    }
  }
  return reached;
}

/**
 * True when some unresolved local-looking specifier in the project could have
 * named this file, i.e. the import graph may be missing an edge INTO it. Used
 * as the honesty guard on "nothing on the server imports this": with a
 * plausible missing importer we keep the hazard instead of clearing it.
 */
export function couldBeUnresolvedImportTarget(
  file: string,
  unresolvedTails: Set<string>
): boolean {
  const base = path.basename(file).replace(/\.[^.]+$/, '');
  if (unresolvedTails.has(base)) return true;
  return (
    base === 'index' && unresolvedTails.has(path.basename(path.dirname(file)))
  );
}

/**
 * The first file in `hazardFile`'s transitive-importer closure (itself
 * included) that an unresolved specifier could name, or null when the closure
 * is fully resolved. A hit means the set of routes reaching the hazard is a
 * LOWER BOUND: the missing edge could come from a route we placed nowhere, or
 * from a module some other route renders. Walks reverse edges over the WHOLE
 * import graph, not just the server graph, because a module outside the server
 * graph is exactly what an unresolved edge would pull into it.
 */
function unresolvedReachPath(
  hazardFile: string,
  importersOf: Map<string, string[]>,
  unresolvedTails: Set<string>
): string | null {
  const seen = new Set([hazardFile]);
  const queue = [hazardFile];
  for (let index = 0; index < queue.length; index += 1) {
    const file = queue[index];
    if (couldBeUnresolvedImportTarget(file, unresolvedTails)) return file;
    for (const importer of importersOf.get(file) ?? []) {
      if (seen.has(importer)) continue;
      seen.add(importer);
      queue.push(importer);
    }
  }
  return null;
}

/**
 * The project-file tails an unresolved local-looking specifier could name:
 * its last segment, plus the parent segment when the specifier names a
 * directory or an index module ('./components/Foo' and './components/Foo/index'
 * are the same module). Shared by the import graph and the teardown's
 * delete guard so both ask the completeness question the same way.
 */
export function specifierTailCandidates(specifier: string): string[] {
  const segments = specifier.split('/').filter(Boolean);
  const last = segments.at(-1)?.replace(/\.[^.]+$/, '');
  const tails: string[] = [];
  if (last) tails.push(last);
  if ((!last || last === 'index') && segments.length > 1) {
    tails.push(segments.at(-2)!);
  }
  return tails;
}

/** Dependency names declared in cwd/package.json (all four sections). */
export function declaredDependencyNames(cwd: string): Set<string> {
  const names = new Set<string>();
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(cwd, 'package.json'), 'utf8')
    ) as Record<string, Record<string, string> | undefined>;
    for (const section of [
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'optionalDependencies',
    ]) {
      for (const name of Object.keys(pkg[section] ?? {})) names.add(name);
    }
  } catch {
    // No readable package.json: every unresolved specifier is then treated as
    // possibly-local, which only makes the hazard check more conservative.
  }
  return names;
}

/**
 * True when an unresolved specifier is a third-party/builtin module rather
 * than a project path: a node: builtin, or a declared dependency (optionally
 * with a subpath, 'gt-next/server'). Everything else that failed to resolve
 * (relative paths, '@/x' aliases, tsconfig `paths` aliases, baseUrl-relative
 * specifiers) is treated as a project path we could not follow.
 */
/**
 * A memoized "is this specifier's package actually installed?" test, for the
 * specifiers isPackageSpecifier cannot classify: a package used without being
 * declared (a transitive dependency imported directly) resolves for the
 * bundler, so treating its subpath as an unfollowable PROJECT path would make
 * both the hazard guard and the teardown guard fire on nothing.
 */
export function installedPackageChecker(
  cwd: string
): (specifier: string) => boolean {
  const cache = new Map<string, boolean>();
  return (specifier: string): boolean => {
    if (specifier.startsWith('.') || path.isAbsolute(specifier)) return false;
    const packageName = packageNameOfSpecifier(specifier);
    let installed = cache.get(packageName);
    if (installed === undefined) {
      installed = isInstalledUnderAnyAncestor(cwd, packageName);
      cache.set(packageName, installed);
    }
    return installed;
  };
}

/** The package a bare specifier belongs to ('@scope/pkg/sub' -> '@scope/pkg'). */
function packageNameOfSpecifier(specifier: string): string {
  const segments = specifier.split('/');
  return specifier.startsWith('@')
    ? segments.slice(0, 2).join('/')
    : segments[0];
}

/**
 * Node/webpack/Turbopack resolution, not a single-directory check: a bare
 * specifier resolves against `node_modules` in the importing directory AND every
 * ancestor. npm and pnpm workspaces install to the REPO ROOT, so an app at
 * `packages/dashboard` commonly has no `node_modules` of its own, and treating
 * its (undeclared, hoisted) package imports as unfollowable PROJECT paths made a
 * whole-project SSG withhold fire on a specifier whose tail happened to match a
 * file name (round-9 re-attack B5). Walking up is what the bundler does, so a
 * package found anywhere above is a package here.
 */
function isInstalledUnderAnyAncestor(
  from: string,
  packageName: string
): boolean {
  let dir = path.resolve(from);
  for (;;) {
    if (fs.existsSync(path.join(dir, 'node_modules', packageName))) return true;
    const parent = path.dirname(dir);
    if (parent === dir) return false;
    dir = parent;
  }
}

/**
 * Filters the noise out of REGEX-extracted import specifiers. The patterns match
 * `from '<x>'` anywhere in the file text, including inside prose: sniply's
 * `// Extract just the token value from "sniply_session=TOKEN; Path=/; ..."`
 * became a "specifier" that no resolver could follow, and any stage that treats
 * an unfollowable specifier as a possible project path then fires on a comment.
 * A real module specifier carries no whitespace and none of the punctuation that
 * only prose and expressions use, so those are dropped before any decision is
 * taken. Deliberately not a comment stripper: mis-parsing a string containing
 * '//' would HIDE a real import, and both callers fail toward retention, which is
 * the safe direction only while every real import is still seen.
 */
export function isPlausibleModuleSpecifier(specifier: string): boolean {
  if (specifier.length === 0 || specifier.length > 200) return false;
  if (/[\s;=,(){}`<>|]/.test(specifier)) return false;
  return /^[\w@#~./]/.test(specifier);
}

export function isPackageSpecifier(
  specifier: string,
  declaredPackages: Set<string>
): boolean {
  if (specifier.startsWith('.') || path.isAbsolute(specifier)) return false;
  if (isBuiltin(specifier)) return true;
  const segments = specifier.split('/');
  const packageName = specifier.startsWith('@')
    ? segments.slice(0, 2).join('/')
    : segments[0];
  return isBuiltin(packageName) || declaredPackages.has(packageName);
}

/**
 * Resolves an import specifier to its candidate project files: relative
 * specifiers resolve against the importer's directory (at most one match);
 * aliased specifiers ('@/i18n/labels', '~/lib/x', '#app/y') drop their alias
 * segment and suffix-match against the project file list, and baseUrl-style
 * specifiers ('src/i18n/labels') match as-is. Suffix matching can hit more
 * than one file (same tail under different roots), so ALL matches are
 * returned and the caller decides how to treat ambiguity. Bare package
 * imports match nothing.
 *
 * A specifier that carries a module extension resolves against the extensions
 * stripped too: NodeNext/ESM code imports the OUTPUT name ('./labels.js' for
 * labels.ts), and plain ESM JavaScript writes the real one ('./labels.js' for
 * labels.js), and neither form can be found by appending an extension to it.
 * Missing that edge left routes prerendered with a hazard in their graph.
 */
export function resolveImportToProjectFiles(
  specifier: string,
  importerDir: string,
  fileSet: Set<string>,
  projectFiles: string[],
  aliases?: ImportAliases
): string[] {
  const tryBase = (base: string): string[] => {
    for (const ext of EXTENSIONS) {
      if (fileSet.has(base + ext)) return [base + ext];
    }
    for (const ext of EXTENSIONS) {
      const index = path.join(base, `index${ext}`);
      if (fileSet.has(index)) return [index];
    }
    const stripped = stripModuleExtension(base);
    return stripped === null ? [] : tryBase(stripped);
  };
  if (specifier.startsWith('.')) {
    return tryBase(path.resolve(importerDir, specifier));
  }
  if (path.isAbsolute(specifier)) {
    return tryBase(specifier);
  }
  // The project's own tsconfig/jsconfig aliases, which are authoritative: they
  // are how the bundler resolves this specifier. Only when they produce nothing
  // does the suffix heuristic below get a turn.
  if (aliases) {
    for (const base of aliasBases(specifier, aliases)) {
      const resolved = tryBase(base);
      if (resolved.length > 0) return resolved;
    }
  }
  const suffixes: string[] = [];
  const firstSegmentEnd = specifier.indexOf('/');
  if (
    firstSegmentEnd > 0 &&
    ['@', '~', '#'].includes(specifier[0]) &&
    // a scoped package ('@scope/pkg') keeps its scope; only the bare-alias
    // forms '@/x', '~/x', '#x/y' drop the first segment
    (specifier[1] === '/' || specifier[0] !== '@')
  ) {
    suffixes.push(specifier.slice(firstSegmentEnd + 1));
  }
  suffixes.push(specifier);
  const strippedSuffixes: string[] = [];
  for (const suffix of suffixes) {
    const stripped = stripModuleExtension(suffix);
    if (stripped !== null) strippedSuffixes.push(stripped);
  }
  // Appended after the written forms, so an exact match still wins.
  suffixes.push(...strippedSuffixes);
  const matches: string[] = [];
  for (const suffix of suffixes) {
    if (!suffix) continue;
    for (const file of projectFiles) {
      const posix = toPosix(file);
      for (const ext of EXTENSIONS) {
        if (
          posix.endsWith(`/${suffix}${ext}`) ||
          posix.endsWith(`/${suffix}/index${ext}`)
        ) {
          matches.push(file);
        }
      }
    }
    if (matches.length > 0) break;
  }
  return matches;
}

/**
 * The project's own path aliases, read from tsconfig/jsconfig: `baseUrl` and
 * `compilerOptions.paths`. Empty when there is no config, none are declared, or
 * the file cannot be read.
 */
export type ImportAliases = {
  /** absolute directory non-relative specifiers resolve against, or null */
  baseUrl: string | null;
  /** each `paths` pattern, split on its single `*`, with absolute targets */
  patterns: { prefix: string; suffix: string; targets: string[] }[];
};

const EMPTY_ALIASES: ImportAliases = { baseUrl: null, patterns: [] };

/**
 * Loads the project's tsconfig/jsconfig path aliases so specifiers the BUNDLER
 * resolves resolve here too. Without them, every `paths` alias that does not
 * mirror its target's path ('#config' -> src/i18n/routing.ts) was an edge the
 * import graph could not follow, which is what makes a hazard acquittal or a
 * teardown deletion unsafe. `extends` is followed for relative/absolute parents
 * (bounded), and any read/parse failure degrades to "no aliases", i.e. exactly
 * the previous behavior.
 *
 * Not cached deliberately: each pipeline stage loads it once and passes it
 * down, so a project whose config changes between runs is never judged by a
 * stale table.
 */
export function loadImportAliases(cwd: string): ImportAliases {
  let aliases: ImportAliases = EMPTY_ALIASES;
  for (const name of ['tsconfig.json', 'jsconfig.json']) {
    const found = readAliasesFrom(path.join(cwd, name), 0);
    if (found !== null) {
      aliases = found;
      break;
    }
  }
  // package.json `imports` subpath aliases ('#config' -> ./src/i18n/routing.ts)
  // are first-class in Node, webpack 5 and Turbopack, and are NOT a tsconfig
  // concept, so a project can declare one without any tsconfig at all. Missing
  // them left the same edge unfollowable that the tsconfig table exists to
  // close, and the teardown deleted a config file whose only importer reached it
  // through such an alias (round-9 re-attack B2). Appended after the tsconfig
  // patterns, which stay authoritative when both declare the same specifier.
  const subpaths = readPackageSubpathImports(cwd);
  if (subpaths.length === 0) return aliases;
  return {
    baseUrl: aliases.baseUrl,
    patterns: [...aliases.patterns, ...subpaths],
  };
}

/**
 * The project's `package.json` "imports" map, as alias patterns. Only targets
 * that name a path ('./src/...') are kept: a subpath that maps to a package
 * ('#dep': 'lodash') names no project file. Condition objects
 * ({ node: './a.js', default: './b.js' }) contribute every string leaf, because
 * any of them can be the one the bundler picks.
 */
function readPackageSubpathImports(cwd: string): ImportAliases['patterns'] {
  let declared: unknown;
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(cwd, 'package.json'), 'utf8')
    ) as { imports?: unknown };
    declared = pkg.imports;
  } catch {
    return [];
  }
  if (!declared || typeof declared !== 'object' || Array.isArray(declared)) {
    return [];
  }
  const patterns: ImportAliases['patterns'] = [];
  for (const [pattern, value] of Object.entries(
    declared as Record<string, unknown>
  )) {
    // Node requires every key to start with '#'; anything else is not a subpath
    // import and must not be treated as one.
    if (!pattern.startsWith('#')) continue;
    const targets = conditionTargets(value, 0)
      .filter((target) => target.startsWith('.'))
      .map((target) => path.resolve(cwd, target));
    if (targets.length === 0) continue;
    const star = pattern.indexOf('*');
    patterns.push(
      star === -1
        ? { prefix: pattern, suffix: '', targets }
        : {
            prefix: pattern.slice(0, star),
            suffix: pattern.slice(star + 1),
            targets,
          }
    );
  }
  return patterns;
}

/** Every string leaf of an "imports" value (string, array, or condition map). */
function conditionTargets(value: unknown, depth: number): string[] {
  if (typeof value === 'string') return [value];
  if (depth > 4 || value === null || typeof value !== 'object') return [];
  const nested = Array.isArray(value) ? value : Object.values(value);
  return nested.flatMap((entry) => conditionTargets(entry, depth + 1));
}

function readAliasesFrom(
  configFile: string,
  depth: number
): ImportAliases | null {
  if (depth > 4) return null;
  let config: {
    extends?: unknown;
    compilerOptions?: { baseUrl?: unknown; paths?: unknown };
  };
  try {
    config = parseJsonWithComments(fs.readFileSync(configFile, 'utf8')) as {
      extends?: unknown;
      compilerOptions?: { baseUrl?: unknown; paths?: unknown };
    };
  } catch {
    return null;
  }
  const dir = path.dirname(configFile);
  // A config that declares nothing itself still counts when its parent does.
  let inherited: ImportAliases = EMPTY_ALIASES;
  if (typeof config.extends === 'string' && config.extends.startsWith('.')) {
    const parentPath = path.resolve(dir, config.extends);
    inherited =
      readAliasesFrom(parentPath, depth + 1) ??
      readAliasesFrom(`${parentPath}.json`, depth + 1) ??
      EMPTY_ALIASES;
  }
  const options = config.compilerOptions ?? {};
  const baseUrl =
    typeof options.baseUrl === 'string'
      ? path.resolve(dir, options.baseUrl)
      : inherited.baseUrl;
  const patterns = [...inherited.patterns];
  const declared = options.paths;
  if (declared && typeof declared === 'object') {
    // `paths` targets are relative to baseUrl when it is set, otherwise to the
    // config's own directory (the TS 4.4+ default).
    const root = baseUrl ?? dir;
    for (const [pattern, targets] of Object.entries(
      declared as Record<string, unknown>
    )) {
      if (!Array.isArray(targets)) continue;
      const star = pattern.indexOf('*');
      const resolved = targets
        .filter((target): target is string => typeof target === 'string')
        .map((target) => path.resolve(root, target));
      if (resolved.length === 0) continue;
      patterns.push(
        star === -1
          ? { prefix: pattern, suffix: '', targets: resolved }
          : {
              prefix: pattern.slice(0, star),
              suffix: pattern.slice(star + 1),
              targets: resolved,
            }
      );
    }
  }
  return { baseUrl, patterns };
}

/**
 * JSON.parse with the tsconfig dialect's slack: line/block comments and
 * trailing commas. String contents are preserved (the scanner tracks quoting),
 * so a `//` inside a path value survives.
 */
function parseJsonWithComments(text: string): unknown {
  let out = '';
  let inString = false;
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (inString) {
      out += char;
      if (char === '\\') {
        out += text[index + 1] ?? '';
        index += 2;
        continue;
      }
      if (char === '"') inString = false;
      index += 1;
      continue;
    }
    if (char === '"') {
      inString = true;
      out += char;
      index += 1;
      continue;
    }
    if (char === '/' && text[index + 1] === '/') {
      while (index < text.length && text[index] !== '\n') index += 1;
      continue;
    }
    if (char === '/' && text[index + 1] === '*') {
      index += 2;
      while (
        index < text.length &&
        !(text[index] === '*' && text[index + 1] === '/')
      ) {
        index += 1;
      }
      index += 2;
      continue;
    }
    out += char;
    index += 1;
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}

/**
 * The candidate file bases an alias table maps this specifier onto: every
 * matching `paths` pattern's substitutions first (most specific pattern wins,
 * as in TypeScript), then the baseUrl-relative path.
 */
function aliasBases(specifier: string, aliases: ImportAliases): string[] {
  const matches = aliases.patterns
    .filter(
      (pattern) =>
        specifier.startsWith(pattern.prefix) &&
        specifier.endsWith(pattern.suffix) &&
        specifier.length >= pattern.prefix.length + pattern.suffix.length
    )
    // Longest prefix first: '@/lib/*' outranks '@/*' for '@/lib/x'.
    .sort((a, b) => b.prefix.length - a.prefix.length);
  const bases: string[] = [];
  for (const pattern of matches) {
    const captured = specifier.slice(
      pattern.prefix.length,
      specifier.length - pattern.suffix.length
    );
    for (const target of pattern.targets) {
      bases.push(target.includes('*') ? target.replace('*', captured) : target);
    }
  }
  if (aliases.baseUrl !== null) {
    bases.push(path.resolve(aliases.baseUrl, specifier));
  }
  return bases;
}

/**
 * A specifier/path with its trailing module extension removed, or null when it
 * carries none. Only the JS/TS module extensions are stripped, so a data path
 * ('./labels.json') and a dotted filename ('./chart.min') keep theirs.
 */
function stripModuleExtension(specifier: string): string | null {
  const match = /\.[cm]?[jt]sx?$/.exec(specifier);
  return match === null ? null : specifier.slice(0, match.index);
}

/** Minimal recursive AST walk; node shapes only, no scope needed. */
function walkNodes(root: t.Node, visit: (node: t.Node) => void): void {
  const stack: t.Node[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    visit(node);
    for (const key of Object.keys(node)) {
      const value = (node as unknown as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item && typeof item === 'object' && 'type' in item) {
            stack.push(item as t.Node);
          }
        }
      } else if (value && typeof value === 'object' && 'type' in value) {
        stack.push(value as t.Node);
      }
    }
  }
}

function toPosix(file: string): string {
  return file.split(path.sep).join('/');
}
