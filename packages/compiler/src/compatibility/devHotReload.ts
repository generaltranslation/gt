import fs from 'node:fs';
import path from 'node:path';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { getTsconfig, type Cache } from 'get-tsconfig';

export type DevHotReloadModuleCompatibility =
  | { compatible: true }
  | {
      compatible: false;
      detectedModuleType: string;
      reason: 'commonjs' | 'legacy-esm';
    };

const TOP_LEVEL_AWAIT_MODULE_TYPES = new Set(['es2022', 'esnext', 'preserve']);
const LEGACY_ESM_MODULE_TYPES = new Set(['es6', 'es2015', 'es2020']);
const COMMONJS_MODULE_TYPES = new Set(['commonjs', 'node', 'amd', 'umd']);
const NODE_MODULE_TYPES = new Set(['node16', 'node18', 'node20', 'nodenext']);

type PackageJson = { type?: string };

function getExtension(filename: string): string {
  return path.extname(filename.split('?')[0]).toLowerCase();
}

function findPackageType(
  filename: string,
  packageTypeCache: Map<string, string | undefined>
): string | undefined {
  let directory = path.dirname(filename);

  while (true) {
    if (packageTypeCache.has(directory)) {
      return packageTypeCache.get(directory);
    }

    const packagePath = path.join(directory, 'package.json');
    if (fs.existsSync(packagePath)) {
      try {
        const packageJson = JSON.parse(
          fs.readFileSync(packagePath, 'utf8')
        ) as PackageJson;
        const packageType = packageJson.type?.toLowerCase();
        packageTypeCache.set(directory, packageType);
        return packageType;
      } catch {
        packageTypeCache.set(directory, undefined);
        return undefined;
      }
    }

    const parent = path.dirname(directory);
    if (parent === directory) {
      packageTypeCache.set(directory, undefined);
      return undefined;
    }
    directory = parent;
  }
}

function usesEsModules(ast: t.File): boolean {
  return ast.program.body.some(
    (statement) =>
      t.isImportDeclaration(statement) ||
      t.isExportNamedDeclaration(statement) ||
      t.isExportDefaultDeclaration(statement) ||
      t.isExportAllDeclaration(statement)
  );
}

function usesCommonJs(ast: t.File): boolean {
  let commonJsDetected = false;

  traverse(ast, {
    CallExpression(path) {
      if (t.isIdentifier(path.node.callee, { name: 'require' })) {
        commonJsDetected = true;
        path.stop();
      }
    },
    MemberExpression(path) {
      if (
        t.isIdentifier(path.node.object) &&
        (path.node.object.name === 'module' ||
          path.node.object.name === 'exports')
      ) {
        commonJsDetected = true;
        path.stop();
      }
    },
  });

  return commonJsDetected;
}

function isNodeModuleEsm(
  filename: string,
  packageTypeCache: Map<string, string | undefined>
): boolean {
  const extension = getExtension(filename);
  if (extension === '.mts' || extension === '.mjs') return true;
  if (extension === '.cts' || extension === '.cjs') return false;
  return findPackageType(filename, packageTypeCache) === 'module';
}

export class DevHotReloadCompatibilityResolver {
  private readonly tsconfigCache: Cache = new Map();
  private readonly packageTypeCache = new Map<string, string | undefined>();

  resolve(filename: string, ast: t.File): DevHotReloadModuleCompatibility {
    const extension = getExtension(filename);
    if (extension === '.cts' || extension === '.cjs') {
      return {
        compatible: false,
        detectedModuleType: extension.slice(1),
        reason: 'commonjs',
      };
    }

    let configuredModuleType: string | undefined;
    try {
      configuredModuleType = getTsconfig(
        filename,
        'tsconfig.json',
        this.tsconfigCache
      )?.config.compilerOptions?.module?.toLowerCase();
    } catch {
      // Invalid project configuration is reported by the owning tool. Fall
      // back to the file syntax so this compatibility check stays non-fatal.
    }

    if (configuredModuleType) {
      if (COMMONJS_MODULE_TYPES.has(configuredModuleType)) {
        return {
          compatible: false,
          detectedModuleType: configuredModuleType,
          reason: 'commonjs',
        };
      }
      if (LEGACY_ESM_MODULE_TYPES.has(configuredModuleType)) {
        return {
          compatible: false,
          detectedModuleType: configuredModuleType,
          reason: 'legacy-esm',
        };
      }
      if (TOP_LEVEL_AWAIT_MODULE_TYPES.has(configuredModuleType)) {
        return { compatible: true };
      }
      if (NODE_MODULE_TYPES.has(configuredModuleType)) {
        return isNodeModuleEsm(filename, this.packageTypeCache)
          ? { compatible: true }
          : {
              compatible: false,
              detectedModuleType: `${configuredModuleType} (CommonJS file)`,
              reason: 'commonjs',
            };
      }
    }

    const hasEsmSyntax = usesEsModules(ast);
    const hasCommonJsSyntax = usesCommonJs(ast);
    if (hasCommonJsSyntax && !hasEsmSyntax) {
      return {
        compatible: false,
        detectedModuleType: 'CommonJS syntax',
        reason: 'commonjs',
      };
    }
    if (hasEsmSyntax) return { compatible: true };

    if (
      (extension === '.js' || extension === '.jsx') &&
      findPackageType(filename, this.packageTypeCache) !== 'module'
    ) {
      return {
        compatible: false,
        detectedModuleType: 'CommonJS package',
        reason: 'commonjs',
      };
    }

    return { compatible: true };
  }
}
