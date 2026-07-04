const fs = require('fs');
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const monorepoRoot = path.resolve(__dirname, '../..');
const exampleNodeModules = path.resolve(__dirname, 'node_modules');
const packagesDir = path.resolve(monorepoRoot, 'packages');

const reactDir = fs.realpathSync(path.resolve(exampleNodeModules, 'react'));
const reactNativeDir = fs.realpathSync(
  path.resolve(exampleNodeModules, 'react-native')
);
const expoDir = fs.realpathSync(path.resolve(exampleNodeModules, 'expo'));
const pnpmLinksRoot = findAncestor(expoDir, 'links');

const workspacePackages = {};
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

  if (!entry) continue;

  workspacePackages[pkg.name] = { entry };

  for (const [subpath, config] of Object.entries(pkg.exports || {})) {
    if (subpath === '.' || subpath === './package.json') continue;

    const exportName = `${pkg.name}/${subpath.replace('./', '')}`;
    const sourceField = typeof config === 'object' ? config.source : null;
    const fallback = path.join(
      pkgDir,
      'src',
      `${subpath.replace('./', '')}.ts`
    );
    const subpathEntry = sourceField
      ? path.resolve(pkgDir, sourceField)
      : fs.existsSync(fallback)
        ? fallback
        : null;

    if (subpathEntry) {
      workspacePackages[exportName] = { entry: subpathEntry };
    }
  }
}

function resolveSubpath(pkgDir, subpath) {
  const full = path.join(pkgDir, subpath || 'index.js');
  if (fs.existsSync(full)) return full;
  if (fs.existsSync(`${full}.js`)) return `${full}.js`;
  if (fs.existsSync(path.join(full, 'index.js')))
    return path.join(full, 'index.js');
  return full;
}

function findAncestor(start, name) {
  let current = start;
  while (current !== path.dirname(current)) {
    if (path.basename(current) === name) return current;
    current = path.dirname(current);
  }
  return null;
}

const config = getDefaultConfig(__dirname);

config.watchFolders = [monorepoRoot, pnpmLinksRoot].filter(Boolean);
config.resolver.nodeModulesPaths = [
  exampleNodeModules,
  path.resolve(monorepoRoot, 'node_modules'),
];
config.resolver.unstable_enablePackageExports = true;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react' || moduleName.startsWith('react/')) {
    const subpath =
      moduleName === 'react' ? null : moduleName.slice('react/'.length);
    return {
      type: 'sourceFile',
      filePath: resolveSubpath(reactDir, subpath),
    };
  }

  if (moduleName === 'react-native' || moduleName.startsWith('react-native/')) {
    const subpath =
      moduleName === 'react-native'
        ? null
        : moduleName.slice('react-native/'.length);
    return {
      type: 'sourceFile',
      filePath: resolveSubpath(reactNativeDir, subpath),
    };
  }

  if (workspacePackages[moduleName]) {
    return {
      type: 'sourceFile',
      filePath: workspacePackages[moduleName].entry,
    };
  }

  try {
    return context.resolveRequest(context, moduleName, platform);
  } catch (originalError) {
    try {
      return {
        type: 'sourceFile',
        filePath: require.resolve(moduleName, {
          paths: [
            path.dirname(context.originModulePath),
            exampleNodeModules,
            path.resolve(monorepoRoot, 'node_modules'),
          ],
        }),
      };
    } catch {
      throw originalError;
    }
  }
};

module.exports = config;
