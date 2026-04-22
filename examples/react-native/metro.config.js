const path = require('path');
const fs = require('fs');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const monorepoRoot = path.resolve(__dirname, '../..');
const packageRoot = path.resolve(monorepoRoot, 'packages', 'react-native');
const exampleNodeModules = path.resolve(__dirname, 'node_modules');

const reactDir = fs.realpathSync(path.resolve(exampleNodeModules, 'react'));
const reactNativeDir = fs.realpathSync(
  path.resolve(exampleNodeModules, 'react-native')
);

// Map workspace package names to their source entry points
// so Metro transpiles from source instead of loading pre-built bundles
const workspacePackages = {};
const packagesDir = path.resolve(monorepoRoot, 'packages');
for (const dir of fs.readdirSync(packagesDir)) {
  const pkgJsonPath = path.join(packagesDir, dir, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) continue;
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  const pkgDir = path.join(packagesDir, dir);

  const srcIndex = path.join(pkgDir, 'src', 'index.ts');
  const srcIndexTsx = path.join(pkgDir, 'src', 'index.tsx');
  const entry = fs.existsSync(srcIndexTsx)
    ? srcIndexTsx
    : fs.existsSync(srcIndex)
      ? srcIndex
      : null;

  if (entry) {
    workspacePackages[pkg.name] = { dir: pkgDir, entry };

    // Also map subpath exports to source files
    if (pkg.exports) {
      for (const [subpath, config] of Object.entries(pkg.exports)) {
        if (subpath === '.' || subpath === './package.json') continue;
        const exportName = pkg.name + '/' + subpath.replace('./', '');
        const sourceField = typeof config === 'object' ? config.source : null;
        if (sourceField) {
          workspacePackages[exportName] = {
            dir: pkgDir,
            entry: path.resolve(pkgDir, sourceField),
          };
        } else {
          // Try to find src/<subpath>.ts
          const sub = subpath.replace('./', '');
          const srcFile = path.join(pkgDir, 'src', sub + '.ts');
          if (fs.existsSync(srcFile)) {
            workspacePackages[exportName] = { dir: pkgDir, entry: srcFile };
          }
        }
      }
    }
  }
}

function resolveSubpath(pkgDir, subpath) {
  const full = path.join(pkgDir, subpath || 'index.js');
  if (fs.existsSync(full)) return full;
  if (fs.existsSync(full + '.js')) return full + '.js';
  if (fs.existsSync(path.join(full, 'index.js')))
    return path.join(full, 'index.js');
  return full;
}

const config = {
  watchFolders: [monorepoRoot],
  resolver: {
    nodeModulesPaths: [
      exampleNodeModules,
      path.resolve(packageRoot, 'node_modules'),
      path.resolve(monorepoRoot, 'node_modules'),
    ],
    unstable_enablePackageExports: true,
    resolveRequest: (context, moduleName, platform) => {
      // Singleton: force react and react-native to the example's copy
      if (moduleName === 'react' || moduleName.startsWith('react/')) {
        const subpath =
          moduleName === 'react' ? null : moduleName.slice('react/'.length);
        return {
          type: 'sourceFile',
          filePath: resolveSubpath(reactDir, subpath),
        };
      }
      if (
        moduleName === 'react-native' ||
        moduleName.startsWith('react-native/')
      ) {
        const subpath =
          moduleName === 'react-native'
            ? null
            : moduleName.slice('react-native/'.length);
        return {
          type: 'sourceFile',
          filePath: resolveSubpath(reactNativeDir, subpath),
        };
      }

      // Workspace packages: resolve from source so Metro transpiles them
      // and all their react imports go through our singleton resolver
      if (workspacePackages[moduleName]) {
        return {
          type: 'sourceFile',
          filePath: workspacePackages[moduleName].entry,
        };
      }

      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
