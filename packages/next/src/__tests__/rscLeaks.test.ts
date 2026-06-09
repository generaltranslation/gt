import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

// Transitive RSC import-graph check. Starting from the RSC-safe entrypoints
// and the gt-next server wrappers, walks every static runtime import and
// fails (printing the full import chain) if the graph reaches a context/hook
// module, a client barrel, or a context-backed React API. Modules marked
// 'use client' are intentional server-to-client boundaries and stop the walk.

const packageRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const repoRoot = resolve(packageRoot, '../..');

// ===== Scope ===== //

const entrypoints = [
  'packages/react-core/src/context-rsc.ts',
  'packages/react/src/context-rsc.ts',
  'packages/next/src/index.server.ts',
  'packages/next/src/server.ts',
  ...listSourceFiles('packages/next/src/server-dir'),
  ...listSourceFiles('packages/next/src/branches'),
  ...listSourceFiles('packages/next/src/variables'),
];

// Workspace subpath imports resolved back to their source entrypoints.
const workspaceSourceMap: Record<string, string> = {
  'gt-react': 'packages/react/src/index.ts',
  'gt-react/internal': 'packages/react/src/internal.ts',
  'gt-react/context-rsc': 'packages/react/src/context-rsc.ts',
  '@generaltranslation/react-core': 'packages/react-core/src/index.ts',
  '@generaltranslation/react-core/internal':
    'packages/react-core/src/internal.ts',
  '@generaltranslation/react-core/context-rsc':
    'packages/react-core/src/context-rsc.ts',
};

// Specifiers that must never be imported from the RSC/server graph.
const forbiddenSpecifiers = [
  'gt-react/client',
  'gt-react/context',
  '@generaltranslation/react-core/context',
  'next/navigation',
];

// Resolved source modules that must never be reached from the RSC/server
// graph. The pure getFormatLocales helper is the only hooks/ module that is
// explicitly RSC-safe.
const forbiddenFiles = [
  'packages/react-core/src/context.ts',
  'packages/react-core/src/context/context.ts',
  'packages/react-core/src/context/InternalGTProvider.tsx',
  'packages/react/src/client.ts',
  'packages/react/src/context.client.ts',
  'packages/react/src/context.server.ts',
];
const forbiddenDirs = ['packages/react-core/src/hooks/'];
const allowedFilesInForbiddenDirs = [
  'packages/react-core/src/hooks/utils/getFormatLocales.ts',
];

// React APIs that must not appear in the RSC/server graph.
const forbiddenReactImports = [
  'createContext',
  'useContext',
  'useEffect',
  'useState',
  'useSyncExternalStore',
];

// ===== Walker ===== //

type Violation = { chain: string[]; reason: string };

function listSourceFiles(dir: string): string[] {
  const absolute = join(repoRoot, dir);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute).flatMap((name) => {
    const child = join(absolute, name);
    if (statSync(child).isDirectory()) {
      if (name === '__tests__' || name === '__mocks__') return [];
      return listSourceFiles(join(dir, name));
    }
    if (!/\.(ts|tsx)$/.test(name) || /\.(test|spec)\.(ts|tsx)$/.test(name)) {
      return [];
    }
    return [join(dir, name)];
  });
}

function getRuntimeImports(code: string): string[] {
  const pattern =
    /(?:^|\n)\s*(?:import|export)\s+(type\s+)?[^'";]*?from\s*['"]([^'"]+)['"]|(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g;
  const specifiers: string[] = [];
  for (const match of code.matchAll(pattern)) {
    const isTypeOnly = Boolean(match[1]);
    const specifier = match[2] ?? match[3];
    if (!isTypeOnly && specifier) specifiers.push(specifier);
  }
  return specifiers;
}

function resolveRelative(specifier: string, fromFile: string): string | null {
  const base = resolve(repoRoot, dirname(fromFile), specifier);
  for (const suffix of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
    const candidate = base + suffix;
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return relative(repoRoot, candidate);
    }
  }
  return null;
}

function isClientBoundary(code: string): boolean {
  return /^\s*['"]use client['"]/.test(code);
}

function getForbiddenReactNames(code: string): string[] {
  const found = new Set<string>();
  const pattern = /(?:^|\n)\s*import\s+([^'";]*?)from\s*['"]react['"]/g;
  for (const match of code.matchAll(pattern)) {
    const clause = match[1];
    if (clause.startsWith('type ')) continue;
    const named = clause.match(/\{([^}]*)\}/)?.[1] ?? '';
    for (const piece of named.split(',')) {
      const name = piece
        .replace(/\btype\b/, '')
        .trim()
        .split(/\s+as\s+/)[0];
      if (forbiddenReactImports.includes(name)) found.add(name);
    }
  }
  return [...found];
}

function walk(): { violations: Violation[]; reported: string[] } {
  const violations: Violation[] = [];
  const reported = new Set<string>();
  const parents = new Map<string, string | null>();
  const queue: string[] = [];

  const chainTo = (file: string): string[] => {
    const chain = [file];
    let current = parents.get(file) ?? null;
    while (current) {
      chain.unshift(current);
      current = parents.get(current) ?? null;
    }
    return chain;
  };

  for (const entry of entrypoints) {
    if (!parents.has(entry)) {
      parents.set(entry, null);
      queue.push(entry);
    }
  }

  while (queue.length > 0) {
    const file = queue.shift()!;
    const code = readFileSync(join(repoRoot, file), 'utf8');

    // Intentional server-to-client boundary: do not traverse further.
    if (isClientBoundary(code)) continue;

    // Deprecated modules are outside this check's scope: report, don't walk.
    if (file.includes('/deprecated/')) {
      reported.add(file);
      continue;
    }

    for (const name of getForbiddenReactNames(code)) {
      violations.push({
        chain: [...chainTo(file), name],
        reason: `imports ${name} from react`,
      });
    }

    for (const specifier of getRuntimeImports(code)) {
      if (forbiddenSpecifiers.includes(specifier)) {
        violations.push({
          chain: [...chainTo(file), specifier],
          reason: `imports forbidden module ${specifier}`,
        });
        continue;
      }

      const resolved = specifier.startsWith('.')
        ? resolveRelative(specifier, file)
        : (workspaceSourceMap[specifier] ?? null);
      if (!resolved) continue; // external module (react, gt-i18n, next/headers, ...)

      if (
        forbiddenFiles.includes(resolved) ||
        (forbiddenDirs.some((dir) => resolved.startsWith(dir)) &&
          !allowedFilesInForbiddenDirs.includes(resolved))
      ) {
        violations.push({
          chain: [...chainTo(file), resolved],
          reason: `reaches forbidden module ${resolved}`,
        });
        continue;
      }

      if (!parents.has(resolved)) {
        parents.set(resolved, file);
        queue.push(resolved);
      }
    }
  }

  return { violations, reported: [...reported].sort() };
}

function formatViolations(violations: Violation[]): string {
  return violations
    .map(
      (violation) =>
        `RSC leak detected (${violation.reason}):\n` +
        violation.chain.map((step) => `  -> ${step}`).join('\n')
    )
    .join('\n\n');
}

// ===== Built output scan ===== //

const serverArtifacts = ['dist/index.server.js', 'dist/server.js'];

function buildPackage(): void {
  if (process.env.npm_execpath) {
    execFileSync(process.execPath, [process.env.npm_execpath, 'run', 'build'], {
      cwd: packageRoot,
      stdio: 'pipe',
    });
    return;
  }
  execFileSync('pnpm', ['run', 'build'], { cwd: packageRoot, stdio: 'pipe' });
}

describe('gt-next RSC leak enforcement', () => {
  it('server/RSC import graph stays free of context and client modules', () => {
    const { violations, reported } = walk();
    if (reported.length > 0) {
      // Deprecated modules reachable from the server graph. Not blocking, but
      // surfaced so maintainers can decide whether to address them.
      // eslint-disable-next-line no-console
      console.warn(
        `rscLeaks: skipped ${reported.length} deprecated module(s) reachable from the server graph:\n` +
          reported.map((file) => `  ${file}`).join('\n')
      );
    }
    expect(violations, formatViolations(violations)).toEqual([]);
  });

  describe('built server output', () => {
    beforeAll(() => {
      if (
        serverArtifacts.every((artifact) =>
          existsSync(join(packageRoot, artifact))
        )
      ) {
        return;
      }
      buildPackage();
    });

    it.each(serverArtifacts)('%s contains no client/context leaks', (file) => {
      const code = readFileSync(join(packageRoot, file), 'utf8');
      expect(code).not.toMatch(/["']gt-react\/client["']/);
      expect(code).not.toMatch(/\bcreateContext\b/);
      expect(code).not.toMatch(
        /["']@generaltranslation\/react-core\/context["']/
      );
    });
  });
});
