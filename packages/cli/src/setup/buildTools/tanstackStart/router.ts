// src/router.tsx: the initializeGT call and its translation loader.
import * as t from '@babel/types';
import path from 'node:path';
import { Libraries } from '../../../types/libraries.js';
import { toRelativeImport, type ViteLoaderExport } from '../../setupViteSPA.js';
import type { BuildToolContext, ManualAction } from '../index.js';
import type { CodeStyle } from '../shared/edits.js';
import * as shared from '../shared/initializeGT.js';
import type { SourceFile } from '../shared/source.js';
import { DOCS_URL } from './source.js';

/** The module-scope `initializeGT(...)` call TanStack Start's router makes. */
export function findInitializeCall(
  router: SourceFile
): t.CallExpression | undefined {
  return shared.findInitializeCall(router, Libraries.GT_TANSTACK_START);
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
  return shared.getStorageChangeAction(router, ctx, loaderPassed, {
    call,
    loaderImport,
    docsUrl: DOCS_URL,
  });
}
