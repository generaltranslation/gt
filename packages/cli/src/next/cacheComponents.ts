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

/**
 * Whether the Next.js config may enable cacheComponents. Any value other than
 * a literal false counts, because a missed setting leaves a failing build
 * while a false positive only leaves the layout for the guide.
 */
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
          !t.isBooleanLiteral(value, { value: false })
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

/**
 * Whether the app has the custom getLocale() and getRegion() files gt-next
 * loads (.ts or .js, in the project root or src/). GTProvider awaits both, and
 * their defaults read headers and cookies.
 */
export function hasCustomRequestFunctions(cwd: string): boolean {
  return ['getLocale', 'getRegion'].every((name) =>
    ['', 'src'].some((dir) =>
      ['.ts', '.js'].some((extension) =>
        fs.existsSync(path.join(cwd, dir, `${name}${extension}`))
      )
    )
  );
}
