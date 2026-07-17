import path from 'node:path';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { getTsconfig, type Cache } from 'get-tsconfig';

export type ModuleFormat = 'esm' | 'cjs' | 'unknown';

export type ModuleFormatDetection = {
  format: ModuleFormat;
  detail: string;
};

const ESM_MODULE_TYPES = new Set([
  'es6',
  'es2015',
  'es2020',
  'es2022',
  'esnext',
  'preserve',
]);

function getExtension(filename: string): string {
  return path.extname(filename.split('?')[0]).toLowerCase();
}

function detectFromExtension(filename: string): ModuleFormatDetection | null {
  const extension = getExtension(filename);
  if (extension === '.cjs' || extension === '.cts') {
    return { format: 'cjs', detail: `${extension} file extension` };
  }
  if (extension === '.mjs' || extension === '.mts') {
    return { format: 'esm', detail: `${extension} file extension` };
  }
  return null;
}

function detectFromModuleSetting(moduleSetting: string): ModuleFormatDetection {
  const normalizedModuleSetting = moduleSetting.toLowerCase();
  if (normalizedModuleSetting === 'commonjs') {
    return { format: 'cjs', detail: 'tsconfig module: commonjs' };
  }
  if (ESM_MODULE_TYPES.has(normalizedModuleSetting)) {
    return {
      format: 'esm',
      detail: `tsconfig module: ${normalizedModuleSetting}`,
    };
  }

  // Node module modes depend on the file extension and nearest package.json,
  // while AMD, UMD, SystemJS, and script output are neither ESM nor CommonJS.
  return {
    format: 'unknown',
    detail: `tsconfig module: ${normalizedModuleSetting}`,
  };
}

function detectFromSyntax(ast: t.File): ModuleFormatDetection {
  const hasEsmSyntax = ast.program.body.some(
    (statement) =>
      t.isImportDeclaration(statement) ||
      t.isExportNamedDeclaration(statement) ||
      t.isExportDefaultDeclaration(statement) ||
      t.isExportAllDeclaration(statement)
  );
  let hasCommonJsSyntax = false;

  traverse(ast, {
    CallExpression(path) {
      if (t.isIdentifier(path.node.callee, { name: 'require' })) {
        hasCommonJsSyntax = true;
      }
    },
    MemberExpression(path) {
      if (
        t.isIdentifier(path.node.object) &&
        (path.node.object.name === 'module' ||
          path.node.object.name === 'exports')
      ) {
        hasCommonJsSyntax = true;
      }
    },
  });

  if (hasEsmSyntax && !hasCommonJsSyntax) {
    return { format: 'esm', detail: 'ESM import or export syntax' };
  }
  if (hasCommonJsSyntax && !hasEsmSyntax) {
    return { format: 'cjs', detail: 'CommonJS require or exports syntax' };
  }
  return {
    format: 'unknown',
    detail: hasEsmSyntax
      ? 'mixed ESM and CommonJS syntax'
      : 'no module format signal',
  };
}

/**
 * Detects whether a source file is ESM, CommonJS, or unknown.
 *
 * This intentionally does not claim that detected ESM supports top-level
 * await. Top-level await requires ES2022-or-newer runtime support, and a
 * bundler may choose a different final output format than the source or
 * tsconfig suggests.
 */
export class ModuleFormatResolver {
  private readonly tsconfigCache: Cache = new Map();

  resolve(filename: string, ast: t.File): ModuleFormatDetection {
    const extensionDetection = detectFromExtension(filename);
    if (extensionDetection) return extensionDetection;

    try {
      const moduleSetting = getTsconfig(
        filename,
        'tsconfig.json',
        this.tsconfigCache
      )?.config.compilerOptions?.module;
      if (moduleSetting) return detectFromModuleSetting(moduleSetting);
    } catch {
      // Invalid project configuration is reported by the owning tool. Fall
      // back to syntax detection so this check remains non-fatal.
    }

    return detectFromSyntax(ast);
  }
}
