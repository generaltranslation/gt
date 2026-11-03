import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';

// Handle CommonJS/ESM interop
const traverse = traverseModule.default || traverseModule;

export const CACHE_COMPONENTS_DOCS_URL =
  'https://generaltranslation.com/docs/react/nextjs/cache-components';

/** What a person still has to do on an app with cacheComponents enabled. */
export const CACHE_COMPONENTS_SETUP_STEP =
  'Follow the Cache Components guide to move your routes under app/[locale], add getLocale and getRegion files and a proxy, then add <GTProvider> to the [locale] layout';

const SCRIPT_EXTENSION = /\.(?:[cm]?[jt]sx?)$/;

/** Whether the Next.js config sets cacheComponents: true. */
export function isCacheComponentsEnabled(nextConfigPath: string): boolean {
  let enabled = false;
  try {
    const ast = parse(fs.readFileSync(nextConfigPath, 'utf8'), {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });
    traverse(ast, {
      ObjectProperty(nodePath) {
        const { key, value } = nodePath.node;
        if (
          (t.isIdentifier(key, { name: 'cacheComponents' }) ||
            t.isStringLiteral(key, { value: 'cacheComponents' })) &&
          t.isBooleanLiteral(value, { value: true })
        ) {
          enabled = true;
          nodePath.stop();
        }
      },
    });
  } catch {
    // An unparsable config is reported by handleInitGT.
  }
  return enabled;
}

/** Whether the app already has a custom getLocale() in its root or src/. */
export function hasCustomGetLocale(cwd: string): boolean {
  return ['', 'src'].some((dir) => {
    const absDir = path.join(cwd, dir);
    return (
      fs.existsSync(absDir) &&
      fs
        .readdirSync(absDir)
        .some(
          (file) =>
            SCRIPT_EXTENSION.test(file) &&
            file.replace(SCRIPT_EXTENSION, '') === 'getLocale'
        )
    );
  });
}
