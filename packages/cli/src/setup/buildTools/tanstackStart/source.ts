// Reads the Start entries setup configures.
import fs from 'node:fs';
import path from 'node:path';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { Libraries } from '../../../types/libraries.js';
import { readSourceFile } from '../shared/source.js';

export const DOCS_URL =
  'https://generaltranslation.com/docs/react/tanstack-start/setup';

export const VITE_PLUGIN_SOURCE = `${Libraries.GT_TANSTACK_START}/plugin/vite`;

// Vite's own lookup order for a config file.
const VITE_CONFIG_EXTENSIONS = ['.js', '.mjs', '.ts', '.cjs', '.mts', '.cts'];

function getMissingFileError(file: string): Error {
  return new Error(
    createDiagnosticMessage({
      source: 'gt',
      severity: 'Error',
      whatHappened: 'GT cannot configure this TanStack Start app',
      why: `${file} was not found`,
      reassurance: 'Nothing was changed',
      fix: 'Run `npx gt@latest init` from the app root, or set up GT manually',
      docsUrl: DOCS_URL,
    })
  );
}

export function readViteConfig(appDirectory: string) {
  return readSourceFile(appDirectory, 'vite.config', {
    extensions: VITE_CONFIG_EXTENSIONS,
  });
}

/**
 * Whether the gt-tanstack-start the app resolves has the Vite plugin, which
 * gt-tanstack-start 12 adds; undefined when it is not installed. Checked by
 * capability rather than version, so prereleases of 12 count.
 */
export async function hasVitePlugin(
  appDirectory: string
): Promise<boolean | undefined> {
  for (let dir = path.resolve(appDirectory); ; dir = path.dirname(dir)) {
    const manifest = path.join(
      dir,
      'node_modules',
      Libraries.GT_TANSTACK_START,
      'package.json'
    );
    if (fs.existsSync(manifest)) {
      const { exports } = JSON.parse(
        await fs.promises.readFile(manifest, 'utf8')
      ) as { exports?: Record<string, unknown> };
      return exports?.['./plugin/vite'] !== undefined;
    }
    if (path.dirname(dir) === dir) return undefined;
  }
}

/** Reads the Start entries without writing, so a missing one stops setup. */
export async function inspectTanStackStart(appDirectory: string) {
  const router = await readSourceFile(appDirectory, 'src/router');
  if (!router) throw getMissingFileError('src/router.tsx');
  const viteConfig = await readViteConfig(appDirectory);
  if (!viteConfig) throw getMissingFileError('vite.config.ts');
  return { router, viteConfig };
}
