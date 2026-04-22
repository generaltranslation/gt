import * as path from 'path';
import type { PluginObj, types } from '@babel/core';
import { LOCALE_POLYFILLS, POLYFILLS, type PluginOptions } from './types';
import { resolveLocales } from './utils/resolveLocales';

export default function (
  babel: { types: typeof types },
  {
    locales,
    config,
    configFilePath,
    entryPointFilePath = path.resolve(process.cwd(), 'src', 'App.tsx'),
    excludePolyfills = [],
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
        const imports = [
          ...POLYFILLS.filter(
            (polyfill) => !excludePolyfills.includes(polyfill)
          ),
          ...resolvedLocales.flatMap((locale) => [
            ...LOCALE_POLYFILLS.map((localeData) => `${localeData}/${locale}`),
          ]),
        ];

        const existingImports = new Set<string>();
        programPath.node.body.forEach((node) => {
          if (
            t.isImportDeclaration(node) &&
            typeof node.source.value === 'string' &&
            imports.includes(node.source.value)
          ) {
            existingImports.add(node.source.value);
          }
        });

        const importsToAdd = imports.filter((imp) => !existingImports.has(imp));

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
