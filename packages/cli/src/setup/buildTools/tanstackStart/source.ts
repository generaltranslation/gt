// Reads the Start entries setup configures.
import { createDiagnosticMessage } from 'generaltranslation/internal';
import { readSourceFile } from '../shared/source.js';

export const DOCS_URL =
  'https://generaltranslation.com/docs/react/tanstack-start/setup';

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
  const root = await readSourceFile(appDirectory, 'src/routes/__root');
  if (!root) throw getMissingFileError('src/routes/__root.tsx');
  return {
    router,
    root,
    start: await readSourceFile(appDirectory, 'src/start'),
  };
}
