// src/router.tsx: the initializeGT call and its translation loader.
import * as t from '@babel/types';
import path from 'node:path';
import { Libraries } from '../../../types/libraries.js';
import { toRelativeImport, type ViteLoaderExport } from '../../setupViteSPA.js';
import type { BuildToolContext, ManualAction } from '../index.js';
import type { CodeStyle } from '../shared/edits.js';
import {
  getLocalImport,
  getPropertyName,
  type SourceFile,
} from '../shared/source.js';
import { DOCS_URL } from './source.js';

/** The module-scope `initializeGT(...)` call, which must run before requests. */
export function findInitializeCall(
  file: SourceFile
): t.CallExpression | undefined {
  const local = getLocalImport(
    file,
    'initializeGT',
    Libraries.GT_TANSTACK_START
  );
  if (!local) return undefined;
  for (const statement of file.statements ?? []) {
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
 * Whether the initializeGT options pass a loader: false for the config alone,
 * undefined when the options hide it (other spreads, variables, computed keys).
 */
export function passesLoader(
  router: SourceFile,
  options: t.Node | undefined,
  { appDirectory, configFilepath }: BuildToolContext
): boolean | undefined {
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
    node.type === 'Identifier' && node.name === configBinding;
  if (!options) return undefined;
  if (isConfig(options)) return false;
  if (options.type !== 'ObjectExpression') return undefined;
  let loader = false;
  for (const property of options.properties) {
    if (property.type === 'SpreadElement') {
      if (!isConfig(property.argument)) return undefined;
      continue;
    }
    const name = getPropertyName(property);
    if (name === undefined) return undefined;
    if (name === 'loadTranslations') loader = true;
  }
  return loader;
}

export function getRouterLines(
  router: SourceFile,
  { appDirectory, configFilepath }: BuildToolContext,
  loaderExport: ViteLoaderExport,
  { quote, semi }: Pick<CodeStyle, 'quote' | 'semi'>
): string[] {
  const configImport = toRelativeImport(
    path.dirname(path.join(appDirectory, router.path)),
    path.resolve(appDirectory, configFilepath)
  );
  const importFrom = (bindings: string, source: string) =>
    `import ${bindings} from ${quote}${source}${quote}${semi}`;
  return [
    importFrom('{ initializeGT }', Libraries.GT_TANSTACK_START),
    importFrom('gtConfig', configImport),
    ...(loaderExport
      ? [
          importFrom(
            loaderExport === 'default'
              ? 'loadTranslations'
              : '{ loadTranslations }',
            './loadTranslations'
          ),
        ]
      : []),
    '',
    `initializeGT(${loaderExport ? '{ ...gtConfig, loadTranslations }' : 'gtConfig'})${semi}`,
  ];
}

/** The initializeGT change for a router whose storage no longer matches. */
export function getStorageAction(
  router: SourceFile,
  ctx: BuildToolContext,
  loaderExport: ViteLoaderExport,
  loaderPassed: boolean
): ManualAction {
  const lines = getRouterLines(router, ctx, loaderExport, {
    quote: "'",
    semi: '',
  });
  const call = lines.at(-1)!;
  const loaderImport = loaderExport
    ? lines.find((line) => line.endsWith("'./loadTranslations'"))
    : undefined;
  return {
    whatHappened: `${router.path} initializes GT for ${loaderPassed ? 'local translation files' : 'CDN translations'}, but translations are now ${ctx.translationsDir ? `stored in ${ctx.translationsDir}` : 'loaded from the CDN'}`,
    fix: `Change the initializeGT call in ${router.path} to ${call}${loaderImport ? ` and add ${loaderImport}` : ' and remove the loadTranslations import'} (see ${DOCS_URL})`,
  };
}
