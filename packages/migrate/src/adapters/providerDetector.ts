import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';

const traverse: typeof traverseModule =
  (traverseModule as { default?: typeof traverseModule }).default ||
  traverseModule;

/**
 * Builds an adapter's `hasProvider`: does this code IMPORT the library's
 * provider component (from any module the adapter owns) and RENDER it as JSX?
 * One owner for all three adapters (round-10 arch finding A5): the three
 * hand-copied bodies had already drifted on the one line ever edited, and the
 * drifted copy missed subpath imports (`react-intl/lib`) its own `ownsModule`
 * accepts. Cheap-exits before parsing when the provider name is absent.
 */
export function makeProviderDetector(
  providerName: string,
  ownsModule: (source: string) => boolean
): (code: string) => boolean {
  return function hasProvider(code: string): boolean {
    if (!code.includes(providerName)) return false;
    let ast: t.File;
    try {
      ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
        tokens: true,
        createParenthesizedExpressions: true,
      });
    } catch {
      return false;
    }

    const providerLocals = new Set<string>();
    traverse(ast, {
      ImportDeclaration(path) {
        if (!ownsModule(path.node.source.value)) return;
        for (const specifier of path.node.specifiers) {
          if (!t.isImportSpecifier(specifier)) continue;
          const imported = t.isIdentifier(specifier.imported)
            ? specifier.imported.name
            : specifier.imported.value;
          if (imported === providerName) {
            providerLocals.add(specifier.local.name);
          }
        }
      },
    });
    if (providerLocals.size === 0) return false;

    let found = false;
    traverse(ast, {
      JSXOpeningElement(path) {
        const name = path.node.name;
        if (t.isJSXIdentifier(name) && providerLocals.has(name.name)) {
          found = true;
          path.stop();
        }
      },
    });
    return found;
  };
}
