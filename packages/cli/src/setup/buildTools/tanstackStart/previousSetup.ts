// The previous setup: initializeGT in the router, gtMiddleware in the start
// entry and GTProvider in the root route. It is deprecated but keeps working,
// and the new setup on top of it would nest a second GTProvider, so setup
// leaves it alone and points to the migration guide.
import * as t from '@babel/types';
import { Libraries } from '../../../types/libraries.js';
import type { ManualAction } from '../index.js';
import { rendersElement } from '../shared/jsx.js';
import {
  getLocalImport,
  getNamespaceImport,
  readSourceFile,
  type SourceFile,
} from '../shared/source.js';

const MIGRATION_URL =
  'https://github.com/generaltranslation/gt/tree/main/packages/tanstack-start#migrating-from-the-previous-setup';

// Unparseable files fall back to a text check: a false positive only leaves
// the app unchanged, while a miss could nest a second GTProvider.
export function importsFromStart(file: SourceFile, name: string): boolean {
  if (!file.statements) {
    return new RegExp(`\\b${name}\\b`).test(file.content);
  }
  const namespace = getNamespaceImport(file, Libraries.GT_TANSTACK_START);
  return (
    getLocalImport(file, name, Libraries.GT_TANSTACK_START) !== undefined ||
    (namespace !== undefined &&
      usesNamespaceMember(file.statements, namespace, name))
  );
}

/** Whether code reads `namespace.name` or renders `<namespace.name>`. */
function usesNamespaceMember(
  statements: t.Statement[],
  namespace: string,
  name: string
): boolean {
  let found = false;
  for (const statement of statements) {
    t.traverseFast(statement, (node) => {
      if (
        (node.type === 'MemberExpression' &&
          !node.computed &&
          t.isIdentifier(node.object, { name: namespace }) &&
          t.isIdentifier(node.property, { name })) ||
        (node.type === 'JSXMemberExpression' &&
          t.isJSXIdentifier(node.object, { name: namespace }) &&
          node.property.name === name)
      ) {
        found = true;
      }
    });
  }
  return found;
}

/** Where the app uses the previous setup, such as `initializeGT in src/router.tsx`. */
export async function findPreviousSetup(
  appDirectory: string,
  router: SourceFile
): Promise<string[]> {
  const start = await readSourceFile(appDirectory, 'src/start');
  const root = await readSourceFile(appDirectory, 'src/routes/__root');
  return [
    importsFromStart(router, 'initializeGT') &&
      `initializeGT in ${router.path}`,
    start &&
      importsFromStart(start, 'gtMiddleware') &&
      `gtMiddleware in ${start.path}`,
    root &&
      ((root.statements && rendersElement(root.statements, 'GTProvider')) ||
        importsFromStart(root, 'GTProvider')) &&
      `GTProvider in ${root.path}`,
  ].filter((marker): marker is string => typeof marker === 'string');
}

export function getPreviousSetupAction(markers: string[]): ManualAction {
  return {
    whatHappened: `This app uses the deprecated ${Libraries.GT_TANSTACK_START} setup (${markers.join(', ')}), so GT left its source files unchanged`,
    fix: `Switch to the gtTanstackStart Vite plugin and setupRouterGTIntegration (see ${MIGRATION_URL}). The previous setup keeps working until a future major release`,
  };
}
