import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { examplesDir } from './workspace.ts';
import type { BundleKind } from '../shared/types.ts';

export interface ExampleDefinition {
  id: string;
  title: string;
  pkg: string;
  framework: string;
  description: string;
  dir: string;
  /** Root that `[project]/` sources are relative to (Turbopack only). */
  projectRoot?: (dir: string) => string;
  /** Emitted JS files per bundle kind, read after a build. */
  collect: Partial<Record<BundleKind, (dir: string) => string[]>>;
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

/**
 * The turbopack.root the build actually used, as Next.js records it in the
 * build output, so this never has to repeat the config's calculation.
 */
function turbopackRoot(dir: string): string {
  const files = JSON.parse(
    readFileSync(join(dir, '.next/required-server-files.json'), 'utf8')
  ) as { config: { turbopack?: { root?: string } } };
  return files.config.turbopack?.root ?? dir;
}

const isJs = (file: string) => /\.(m?js|cjs)$/.test(file);

/** Next.js edge files come from the middleware manifest, not a fixed dir. */
function nextEdgeFiles(dir: string): string[] {
  const manifestPath = join(dir, '.next/server/middleware-manifest.json');
  if (!existsSync(manifestPath)) return [];
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    middleware: Record<string, { files: string[] }>;
    functions: Record<string, { files: string[] }>;
  };
  const files = new Set<string>();
  for (const entry of [
    ...Object.values(manifest.middleware ?? {}),
    ...Object.values(manifest.functions ?? {}),
  ]) {
    for (const file of entry.files) {
      if (isJs(file)) files.add(join(dir, '.next', file));
    }
  }
  return [...files].filter((file) => existsSync(file));
}

export const examples: ExampleDefinition[] = [
  {
    id: 'next-app',
    title: 'Next.js App Router',
    pkg: 'gt-next',
    framework: 'Next.js 16, Turbopack',
    description:
      'App Router app set up per the Next.js quickstart, with server and client components.',
    dir: join(examplesDir, 'next-app'),
    projectRoot: turbopackRoot,
    collect: {
      client: (dir) => walk(join(dir, '.next/static')).filter(isJs),
      server: (dir) => {
        const edge = new Set(nextEdgeFiles(dir));
        return walk(join(dir, '.next/server')).filter(
          (file) =>
            isJs(file) &&
            !edge.has(file) &&
            !file.includes('/.next/server/edge/') &&
            !/(manifest|_client-reference-manifest)\.js$/.test(file)
        );
      },
      edge: nextEdgeFiles,
    },
  },
  {
    id: 'tanstack-start',
    title: 'TanStack Start',
    pkg: 'gt-tanstack-start',
    framework: 'TanStack Start, Vite 8',
    description:
      'Server-rendered TanStack Start app set up per the TanStack Start quickstart.',
    dir: join(examplesDir, 'tanstack-start'),
    collect: {
      client: (dir) => walk(join(dir, 'dist/client')).filter(isJs),
      server: (dir) => walk(join(dir, 'dist/server')).filter(isJs),
    },
  },
  {
    id: 'vite-react',
    title: 'Vite React',
    pkg: 'gt-react',
    framework: 'React 19, Vite 8',
    description: 'Single-page React app set up per the React SPA quickstart.',
    dir: join(examplesDir, 'vite-react'),
    collect: {
      client: (dir) => walk(join(dir, 'dist')).filter(isJs),
    },
  },
  {
    id: 'vite-vue',
    title: 'Vite Vue',
    pkg: 'gt-vue',
    framework: 'Vue 3, Vite 8',
    description:
      'Vue app set up per the Vue quickstart with the createGT plugin.',
    dir: join(examplesDir, 'vite-vue'),
    collect: {
      client: (dir) => walk(join(dir, 'dist')).filter(isJs),
    },
  },
];

export function findExample(id: string): ExampleDefinition | undefined {
  return examples.find((example) => example.id === id);
}
