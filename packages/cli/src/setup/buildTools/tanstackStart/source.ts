// Reads the Start entries setup configures.
import { createDiagnosticMessage } from 'generaltranslation/internal';
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

/** Reads the Start entries without writing, so a missing one stops setup. */
export async function inspectTanStackStart(appDirectory: string) {
  const router = await readSourceFile(appDirectory, 'src/router');
  if (!router) throw getMissingFileError('src/router.tsx');
  const viteConfig = await readSourceFile(appDirectory, 'vite.config', {
    extensions: VITE_CONFIG_EXTENSIONS,
  });
  if (!viteConfig) throw getMissingFileError('vite.config.ts');
  return { router, viteConfig };
}
