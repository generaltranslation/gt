import fs from 'node:fs';
import path from 'node:path';
import { isBuiltin } from 'node:module';
import { parse } from '@babel/parser';
import * as t from '@babel/types';
import type { MigrationContext } from './types.js';

const EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js'];

/**
 * Test-ish files are not routes; prerendering never executes them, so a
 * client call there is a test concern (reported through the test-file
 * handling), not a build hazard. Shared with the driver, which routes these
 * files into the explicit tests-need-manual-migration stage.
 */
export const TEST_FILE_PATH =
  /(^|\/)(__tests__|__mocks__|tests?|e2e)\/|\.(test|spec)\.[cm]?[jt]sx?$|(^|\/)(vitest|jest)\.setup\./;
const TEST_PATH = TEST_FILE_PATH;

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
  const readFile = (file: string): string | null => {
    if (!contentCache.has(file)) {
      try {
        contentCache.set(file, fs.readFileSync(file, 'utf8'));
      } catch {
        contentCache.set(file, null);
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

  const clientBasenames = [...clientModules].map((file) =>
    path.basename(file).replace(/\.[^.]+$/, '')
  );

  // 2. Import graph + the server render graph reachable from route entries.
  const graph = buildImportGraph(ctx, projectFiles, fileSet, readFile);
  const serverGraph = collectServerGraph(
    ctx,
    projectFiles,
    graph.imports,
    clientModules
  );

  // 3. Server modules calling functions imported from those client modules.
  const hazards: NonNullable<MigrationContext['latentClientCallHazards']> = [];
  for (const file of projectFiles) {
    if (clientModules.has(file)) continue;
    if (TEST_PATH.test(toPosix(file))) continue;
    const code = readFile(file);
    if (!code) continue;
    // Cheap prefilter: an import of a client module must at least mention its
    // basename somewhere in the file.
    if (!clientBasenames.some((base) => code.includes(base))) continue;
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
        projectFiles
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
      });
      continue;
    }
    // Outside the server graph. That is only a real acquittal if the graph is
    // complete for this file: an import specifier we could not resolve (a
    // tsconfig `paths` alias, a webpack alias) could be the server importer we
    // never saw. When one could plausibly point here, keep the hazard with no
    // reaching entries, which makes the emit phase withhold globally the way
    // it always did rather than emit a build that crashes on prerender.
    if (couldBeUnresolvedImportTarget(file, graph.unresolvedTails)) {
      hazards.push({
        caller: file,
        importedName: found.importedName,
        clientModule: found.clientModule,
        reachedFrom: [],
      });
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
): { imports: Map<string, string[]>; unresolvedTails: Set<string> } {
  const specifierPatterns = [
    /\bfrom\s*['"]([^'"\n]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g,
    /\bimport\s+['"]([^'"\n]+)['"]/g,
    /\brequire\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g,
  ];
  const declaredPackages = declaredDependencyNames(ctx.cwd);
  const imports = new Map<string, string[]>();
  const unresolvedTails = new Set<string>();
  for (const file of projectFiles) {
    const code = readFile(file);
    if (!code) continue;
    const specifiers = new Set<string>();
    for (const pattern of specifierPatterns) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(code)) !== null) specifiers.add(match[1]);
    }
    const targets = new Set<string>();
    for (const specifier of specifiers) {
      const resolved = resolveImportToProjectFiles(
        specifier,
        path.dirname(file),
        fileSet,
        projectFiles
      );
      if (resolved.length > 0) {
        for (const target of resolved) {
          if (target !== file) targets.add(target);
        }
        continue;
      }
      if (isPackageSpecifier(specifier, declaredPackages)) continue;
      // Local-looking and unresolved: remember what it could have pointed at.
      const segments = specifier.split('/').filter(Boolean);
      const last = segments.at(-1)?.replace(/\.[^.]+$/, '');
      if (last) unresolvedTails.add(last);
      // './components/Foo/index' and './components/Foo' can name the same
      // module, so the parent segment is a candidate tail too.
      if ((!last || last === 'index') && segments.length > 1) {
        unresolvedTails.add(segments.at(-2)!);
      }
    }
    imports.set(file, [...targets]);
  }
  return { imports, unresolvedTails };
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
function couldBeUnresolvedImportTarget(
  file: string,
  unresolvedTails: Set<string>
): boolean {
  const base = path.basename(file).replace(/\.[^.]+$/, '');
  if (unresolvedTails.has(base)) return true;
  return (
    base === 'index' && unresolvedTails.has(path.basename(path.dirname(file)))
  );
}

/** Dependency names declared in cwd/package.json (all four sections). */
function declaredDependencyNames(cwd: string): Set<string> {
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
function isPackageSpecifier(
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
 */
export function resolveImportToProjectFiles(
  specifier: string,
  importerDir: string,
  fileSet: Set<string>,
  projectFiles: string[]
): string[] {
  const tryBase = (base: string): string[] => {
    for (const ext of EXTENSIONS) {
      if (fileSet.has(base + ext)) return [base + ext];
    }
    for (const ext of EXTENSIONS) {
      const index = path.join(base, `index${ext}`);
      if (fileSet.has(index)) return [index];
    }
    return [];
  };
  if (specifier.startsWith('.')) {
    return tryBase(path.resolve(importerDir, specifier));
  }
  if (path.isAbsolute(specifier)) {
    return tryBase(specifier);
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
