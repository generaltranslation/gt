import * as path from 'path';
import type { PluginObj, types } from '@babel/core';
import {
  FORCED_POLYFILL_IMPORTS,
  LOCALE_POLYFILLS,
  POLYFILLS,
  type ForceablePolyfill,
  type Polyfill,
  type PluginOptions,
} from './types';
import { resolveLocales } from './utils/resolveLocales';

function isForceablePolyfill(
  polyfill: Polyfill
): polyfill is ForceablePolyfill {
  return polyfill in FORCED_POLYFILL_IMPORTS;
}

function getPolyfillImport(
  polyfill: Polyfill,
  forcePolyfills: PluginOptions['forcePolyfills']
): string {
  if (isForceablePolyfill(polyfill) && forcePolyfills?.includes(polyfill)) {
    return FORCED_POLYFILL_IMPORTS[polyfill];
  }

  return polyfill;
}

function getPolyfillAliases(polyfill: Polyfill): string[] {
  return isForceablePolyfill(polyfill)
    ? [polyfill, FORCED_POLYFILL_IMPORTS[polyfill]]
    : [polyfill];
}

export function plugin(
  babel: { types: typeof types },
  {
    locales,
    config,
    configFilePath,
    entryPointFilePath = path.resolve(process.cwd(), 'src', 'App.tsx'),
    excludePolyfills = [],
    forcePolyfills = [],
  }: PluginOptions
): PluginObj {
  const { types: t } = babel;

  return {
    name: 'gt-react-native/plugin',
    visitor: {
      Program(programPath, state) {
        const currentFilePath = path.resolve(
          state.filename || state.file.opts.filename || ''
        );

        // Only apply polyfills to files that import gt-react-native or generaltranslation
        if (currentFilePath !== entryPointFilePath) {
          return;
        }

        const resolvedLocales = resolveLocales({
          locales,
          config,
          configFilePath,
        });

        // TODO: smart imports based on if the polyfill is required, do this as a wrapper around AppRegistry.registerComponent()
        const polyfillImports = POLYFILLS.filter(
          (polyfill) => !excludePolyfills.includes(polyfill)
        ).map((polyfill) => ({
          aliases: getPolyfillAliases(polyfill),
          source: getPolyfillImport(polyfill, forcePolyfills),
        }));
        const localeImports = resolvedLocales.flatMap((locale) =>
          LOCALE_POLYFILLS.map((localeData) => `${localeData}/${locale}`)
        );

        const existingImports = new Set<string>();
        programPath.node.body.forEach((node) => {
          if (
            t.isImportDeclaration(node) &&
            typeof node.source.value === 'string'
          ) {
            existingImports.add(node.source.value);
          }
        });

        const importsToAdd = [
          ...polyfillImports
            .filter(({ aliases }) =>
              aliases.every((alias) => !existingImports.has(alias))
            )
            .map(({ source }) => source),
          ...localeImports.filter((source) => !existingImports.has(source)),
        ];

        if (importsToAdd.length > 0) {
          const newImports = importsToAdd.map((importPath) =>
            t.importDeclaration([], t.stringLiteral(importPath))
          );

          programPath.node.body.unshift(...newImports);
        }
      },
    },
  };
}
