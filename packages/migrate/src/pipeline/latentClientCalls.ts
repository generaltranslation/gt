import fs from 'node:fs';
import path from 'node:path';
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
 * Finds latent React Server Components violations the app already carries:
 * a server module (no 'use client' directive) that CALLS a function imported
 * from a client module (e.g. a server page calling a useLocalizedLabel()
 * hook exported by a 'use client' file). Rendering such a route on the
 * server throws "Attempted to call <fn>() from the server", but a baseline
 * app whose routes all render dynamically may never hit it at build time.
 * gt migrate's static-rendering restoration would make prerender execute the
 * call and fail the build (the round-7 Sniply /about, /terms, /privacy
 * failures), so the emit phase withholds the locale resolvers while any of
 * these exist and the report names each one.
 *
 * Only direct calls count: rendering a client COMPONENT from a server file
 * (<ClientThing />) and passing a client function around as a reference are
 * both legal composition and must not trip this.
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

  // 2. Server modules calling functions imported from those client modules.
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
      const resolved = resolveImportToProjectFile(
        statement.source.value,
        path.dirname(file),
        fileSet,
        projectFiles
      );
      if (!resolved || !clientModules.has(resolved)) continue;
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
    if (hazard !== null) {
      const found: { importedName: string; clientModule: string } = hazard;
      hazards.push({
        caller: file,
        importedName: found.importedName,
        clientModule: found.clientModule,
      });
    }
  }
  if (hazards.length > 0) {
    ctx.latentClientCallHazards = hazards;
  }
}

/**
 * Resolves an import specifier to a project file: relative specifiers resolve
 * against the importer's directory; aliased specifiers ('@/i18n/labels',
 * '~/lib/x', '#app/y') drop their alias segment and suffix-match against the
 * project file list, and baseUrl-style specifiers ('src/i18n/labels') match
 * as-is. Bare package imports match nothing and return null.
 */
function resolveImportToProjectFile(
  specifier: string,
  importerDir: string,
  fileSet: Set<string>,
  projectFiles: string[]
): string | null {
  const tryBase = (base: string): string | null => {
    for (const ext of EXTENSIONS) {
      if (fileSet.has(base + ext)) return base + ext;
    }
    for (const ext of EXTENSIONS) {
      const index = path.join(base, `index${ext}`);
      if (fileSet.has(index)) return index;
    }
    return null;
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
  for (const suffix of suffixes) {
    if (!suffix) continue;
    for (const file of projectFiles) {
      const posix = toPosix(file);
      for (const ext of EXTENSIONS) {
        if (
          posix.endsWith(`/${suffix}${ext}`) ||
          posix.endsWith(`/${suffix}/index${ext}`)
        ) {
          return file;
        }
      }
    }
  }
  return null;
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
