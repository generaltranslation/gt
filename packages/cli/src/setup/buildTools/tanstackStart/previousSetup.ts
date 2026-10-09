// The previous setup: initializeGT in the router, gtMiddleware in the start
// entry and GTProvider in the root route. It keeps working, and the new setup
// on top of it would nest a second GTProvider, so setup leaves it alone.
import * as t from '@babel/types';
import path from 'node:path';
import { Libraries } from '../../../types/libraries.js';
import type { ViteLoaderExport } from '../../setupViteSPA.js';
import type { BuildToolContext, ManualAction } from '../index.js';
import { rendersElement } from '../shared/jsx.js';
import {
  getLocalImport,
  getNamespaceImport,
  getPropertyName,
  readSourceFile,
  type SourceFile,
} from '../shared/source.js';
import { DOCS_URL } from './source.js';

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
    whatHappened: `This app uses the previous ${Libraries.GT_TANSTACK_START} setup (${markers.join(', ')}), so GT left its source files unchanged`,
    fix: `Keep the previous setup, which still works, or switch to setupRouterGTIntegration and the gtTanstackStart Vite plugin (see ${DOCS_URL})`,
  };
}

/** The previous setup's module-scope `initializeGT(...)` call. */
function findInitializeCall(router: SourceFile): t.CallExpression | undefined {
  const local = getLocalImport(
    router,
    'initializeGT',
    Libraries.GT_TANSTACK_START
  );
  if (!local) return undefined;
  for (const statement of router.statements ?? []) {
    if (
      statement.type === 'ExpressionStatement' &&
      statement.expression.type === 'CallExpression' &&
      t.isIdentifier(statement.expression.callee, { name: local })
    ) {
      return statement.expression;
    }
  }
  return undefined;
}

/**
 * Whether the previous setup's initializeGT gets the config without a loader,
 * so it loads translations from the CDN. Options that could hide a loader
 * (other spreads, variables, computed keys) do not count.
 */
export function initializesWithoutLoader(
  router: SourceFile,
  { appDirectory, configFilepath }: BuildToolContext
): boolean {
  const options = findInitializeCall(router)?.arguments[0];
  if (!options) return false;
  const configPath = path.resolve(appDirectory, configFilepath);
  const routerDirectory = path.dirname(path.join(appDirectory, router.path));
  const configBinding = router.statements
    ?.filter((statement) => statement.type === 'ImportDeclaration')
    .find(
      (statement) =>
        path.resolve(routerDirectory, statement.source.value) === configPath
    )
    ?.specifiers.find(
      (specifier) => specifier.type === 'ImportDefaultSpecifier'
    )?.local.name;
  const isConfig = (node: t.Node) =>
    configBinding !== undefined &&
    t.isIdentifier(node, { name: configBinding });
  if (isConfig(options)) return true;
  if (options.type !== 'ObjectExpression') return false;
  return options.properties.every((property) =>
    property.type === 'SpreadElement'
      ? isConfig(property.argument)
      : ![undefined, 'loadTranslations'].includes(getPropertyName(property))
  );
}

/** Asks to pass the loader to the previous setup's initializeGT. */
export function getInitializeLoaderAction(
  routerPath: string,
  translationsDir: string,
  loaderExport: Exclude<ViteLoaderExport, undefined>
): ManualAction {
  const loaderImport =
    loaderExport === 'default' ? 'loadTranslations' : '{ loadTranslations }';
  return {
    whatHappened: `${routerPath} initializes GT for CDN translations, but translations are now stored in ${translationsDir}`,
    fix: `Pass loadTranslations to the initializeGT call in ${routerPath}, such as initializeGT({ ...gtConfig, loadTranslations }), and add import ${loaderImport} from './loadTranslations' (see ${DOCS_URL})`,
  };
}
