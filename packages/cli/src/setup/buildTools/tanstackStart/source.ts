// Reads the Start entries setup configures.
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { Libraries } from '../../../types/libraries.js';
import { readSourceFile } from '../shared/source.js';
import { readViteConfig } from '../shared/viteConfig.js';

export const DOCS_URL =
  'https://generaltranslation.com/docs/react/tanstack-start/setup';

export const VITE_PLUGIN_SOURCE = `${Libraries.GT_TANSTACK_START}/plugin/vite`;

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
  const viteConfig = await readViteConfig(appDirectory);
  if (!viteConfig) throw getMissingFileError('vite.config.ts');
  return { router, viteConfig };
}
