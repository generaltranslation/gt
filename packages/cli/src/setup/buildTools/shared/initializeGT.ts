// The initializeGT call an app entry makes, the loader it passes, and the
// change it needs when translation storage moved.
import * as t from '@babel/types';
import path from 'node:path';
import type { BuildToolContext, ManualAction } from '../index.js';
import { getLocalImport, getPropertyName, type SourceFile } from './source.js';

/** The module-scope `initializeGT(...)` call, which must run before requests. */
export function findInitializeCall(
  file: SourceFile,
  source: string
): t.CallExpression | undefined {
  const local = getLocalImport(file, 'initializeGT', source);
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
 * Callers report a mismatch only when this is certain.
 */
export function passesLoader(
  file: SourceFile,
  options: t.Node | undefined,
  { appDirectory, configFilepath }: BuildToolContext
): boolean | undefined {
  const configPath = path.resolve(appDirectory, configFilepath);
  const fileDirectory = path.dirname(path.join(appDirectory, file.path));
  const configBinding = file.statements
    ?.filter((statement) => statement.type === 'ImportDeclaration')
    .find(
      (statement) =>
        path.resolve(fileDirectory, statement.source.value) === configPath
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

/**
 * The change an initializeGT call needs when translations moved between local
 * files and the CDN since setup ran. Callers quote the call and loader import
 * they would write.
 */
export function getStorageChangeAction(
  file: SourceFile,
  { translationsDir }: Pick<BuildToolContext, 'translationsDir'>,
  loaderPassed: boolean,
  {
    call,
    loaderImport,
    docsUrl,
  }: { call: string; loaderImport?: string; docsUrl: string }
): ManualAction {
  return {
    whatHappened: `${file.path} initializes GT for ${loaderPassed ? 'local translation files' : 'CDN translations'}, but translations are now ${translationsDir ? `stored in ${translationsDir}` : 'loaded from the CDN'}`,
    fix: `Change the initializeGT call in ${file.path} to ${call}${loaderImport ? ` and add ${loaderImport}` : ' and remove the loadTranslations import'} (see ${docsUrl})`,
  };
}
