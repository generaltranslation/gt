import { ParseResult } from '@babel/parser';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';

// Handle CommonJS/ESM interop
const traverse = traverseModule.default || traverseModule;

/**
 * Given an AST determines if the file needs to be compiled as CommonJS or ESM.
 * @param ast - The AST to analyze
 * @returns True if the file needs to be compiled as CommonJS, false if it needs to be compiled as ESM
 */
export function needsCJS({
  ast,
  warnings,
  filepath,
  packageJson,
  tsconfigJson,
}: {
  ast: ParseResult<t.File>;
  warnings: string[];
  filepath: string;
  packageJson?: { type?: string };
  tsconfigJson?: { compilerOptions?: { module?: string } };
}) {
  // Analyze the actual file content to determine module system
  let hasES6Imports = false;
  let hasCommonJSRequire = false;

  traverse(ast, {
    ImportDeclaration() {
      hasES6Imports = true;
    },
    CallExpression(path) {
      if (t.isIdentifier(path.node.callee, { name: 'require' })) {
        hasCommonJSRequire = true;
      }
    },
  });

  // Determine if we need CommonJS based on actual file content and fallback to config-based logic
  let needsCJS = false;

  if (hasES6Imports && !hasCommonJSRequire) {
    // File uses ES6 imports, so we should use ES6 imports
    needsCJS = false;
  } else if (hasCommonJSRequire && !hasES6Imports) {
    // File uses CommonJS require, so we should use CommonJS require
    needsCJS = true;
  } else if (hasES6Imports && hasCommonJSRequire) {
    // Mixed usage - this is unusual but we'll default to ES6 imports
    warnings.push(
      `Mixed ES6 imports and CommonJS require detected in ${filepath}. Defaulting to ES6 imports.`
    );
    needsCJS = false;
  } else {
    // No imports/requires found, fall back to configuration-based logic
    if (filepath.endsWith('.ts') || filepath.endsWith('.tsx')) {
      // For TypeScript files, check tsconfig.json compilerOptions.module
      const moduleSetting = tsconfigJson?.compilerOptions?.module;
      if (moduleSetting === 'commonjs' || moduleSetting === 'node') {
        needsCJS = true;
      } else if (
        moduleSetting === 'esnext' ||
        moduleSetting === 'es2022' ||
        moduleSetting === 'es2020' ||
        moduleSetting === 'es2015' ||
        moduleSetting === 'es6' ||
        moduleSetting === 'node16' ||
        moduleSetting === 'nodenext'
      ) {
        needsCJS = false;
      } else {
        // Default to ESM for TypeScript files if no module setting is specified
        needsCJS = false;
      }
    } else if (filepath.endsWith('.js')) {
      // For JavaScript files, check package.json type
      // If package.json has "type": "module", .js files are treated as ES modules
      needsCJS = packageJson?.type !== 'module';
    } else {
      // For other file extensions, default to ESM
      needsCJS = false;
    }
  }

  return needsCJS;
}
