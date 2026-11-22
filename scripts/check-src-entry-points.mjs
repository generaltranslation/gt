#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const ENTRY_FIELDS = [
  'main',
  'module',
  'types',
  'typings',
  'browser',
  'react-native',
  'source',
  'bin',
  'exports',
  'typesVersions',
];

// Fields whose extensionless targets tools resolve by trying extensions, unlike
// `exports`, `bin`, and ESM imports, which resolve exactly.
const EXTENSION_PROBING_FIELDS = new Set([
  'main',
  'module',
  'types',
  'typings',
  'browser',
  'react-native',
  'source',
  'typesVersions',
]);

// Build output directories that hold a whole copy of the source tree, such as
// react-native's `dist/module/` and `dist/commonjs/` and paraglide-js's `dist/src/`.
const OUTPUT_FORMAT_DIRECTORIES = new Set(['commonjs', 'module', 'src']);

function collectPaths(value, paths = []) {
  if (typeof value === 'string') {
    paths.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectPaths(item, paths);
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectPaths(item, paths);
  }
  return paths;
}

export function collectEntryPaths(packageJson) {
  return ENTRY_FIELDS.flatMap((field) => collectPaths(packageJson[field]));
}

function collectModuleSpecifiers(fileName, sourceText) {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.JS
  );
  const specifiers = [];
  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push({
        specifier: node.moduleSpecifier.text,
        probesExtensions: false,
      });
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === 'require')) &&
      node.arguments.length > 0 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      specifiers.push({
        specifier: node.arguments[0].text,
        probesExtensions: ts.isIdentifier(node.expression),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return specifiers;
}

// A `bin` that points at a checked-in shim (such as `bin/main.js`) exposes the
// built files the shim imports, so those count as entries too.
export function collectBinShimEntries(packageJson, readPackageFile) {
  const entries = [];
  for (const binPath of collectPaths(packageJson.bin)) {
    const normalized = path.posix.normalize(binPath);
    if (/^(dist|src)\//.test(normalized)) continue;
    const contents = readPackageFile(normalized);
    if (contents === undefined) continue;
    for (const { specifier, probesExtensions } of collectModuleSpecifiers(
      normalized,
      contents
    )) {
      if (!/^\.{1,2}\//.test(specifier)) continue;
      entries.push({
        entryPath: path.posix.join(path.posix.dirname(normalized), specifier),
        probesExtensions,
      });
    }
  }
  return entries;
}

// Strips only JavaScript, TypeScript, and declaration extensions, so an asset such
// as `data.json` keeps its full name and can only match a source file of that name.
export function stripExtension(fileName) {
  return fileName.replace(/(?:\.d\.[cm]?ts|(?:\.min)?\.[cm]?[jt]sx?)$/, '');
}

// Lists the source stems an entry may be built from, most specific first, so
// output-format directories resolve: `dist/module/index.js` yields `module/index`, then `index`.
export function entrySourceStems(entryPath) {
  const segments = entryPath.replace(/^\.\//, '').split('/');
  const root = segments.shift();
  if (segments.length === 0) return [];
  segments.push(stripExtension(segments.pop()));
  if (root === 'src') return [segments.join('/')];
  if (root !== 'dist') return [];
  const stems = [segments.join('/')];
  if (
    segments.length > 1 &&
    OUTPUT_FORMAT_DIRECTORIES.has(segments[0]) &&
    !entryPath.includes('*')
  ) {
    stems.push(segments.slice(1).join('/'));
  }
  return stems;
}

function stemMatches(stem, sourceStem) {
  if (!stem.includes('*')) return stem === sourceStem;
  const pattern = stem
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('[^/]+');
  return new RegExp(`^${pattern}$`).test(sourceStem);
}

// A code source backs a target that names a built code file or is a wildcard; an
// extensionless target resolved by trying extensions deliberately backs every root
// file with that base name (resolvers disagree on the order) unless a file matches
// it exactly; any other target must name the source file itself, as an asset does.
function entryCoversSource(
  entryPath,
  stem,
  file,
  probesExtensions,
  exactSourceExists
) {
  const targetName = entryPath.split('/').pop();
  const sourceStem = stripExtension(file);
  const isCodeSource = sourceStem !== file;
  if (stripExtension(targetName) !== targetName) {
    return isCodeSource && stemMatches(stem, sourceStem);
  }
  if (stem.includes('*')) return stemMatches(stem, sourceStem);
  if (file === stem) return true;
  if (!probesExtensions || exactSourceExists) return false;
  const lastDot = file.lastIndexOf('.');
  return (
    sourceStem === stem || (lastDot > 0 && file.slice(0, lastDot) === stem)
  );
}

export function findUnexportedSourceRootFiles({
  packageJson,
  sourceFiles,
  extraEntries = [],
}) {
  const entries = [
    ...ENTRY_FIELDS.flatMap((field) =>
      collectPaths(packageJson[field]).map((entryPath) => ({
        entryPath,
        probesExtensions: EXTENSION_PROBING_FIELDS.has(field),
      }))
    ),
    ...extraEntries,
  ];
  const covered = new Set();
  for (const { entryPath, probesExtensions } of entries) {
    const covers = (stem, file) =>
      entryCoversSource(
        entryPath,
        stem,
        file,
        probesExtensions,
        sourceFiles.includes(stem)
      );
    const stem = entrySourceStems(entryPath).find((candidate) =>
      sourceFiles.some((file) => covers(candidate, file))
    );
    if (stem === undefined) continue;
    for (const file of sourceFiles) {
      if (covers(stem, file)) covered.add(file);
    }
  }
  return sourceFiles
    .filter((file) => !file.includes('/') && !covered.has(file))
    .sort();
}

export function listRepositoryFiles(repositoryRoot = process.cwd()) {
  const output = execFileSync(
    'git',
    [
      'ls-files',
      '-z',
      '--cached',
      '--others',
      '--exclude-standard',
      'packages',
    ],
    { cwd: repositoryRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );
  return output
    .split('\0')
    .filter((file) => file && existsSync(path.join(repositoryRoot, file)));
}

export function findViolations(repositoryRoot = process.cwd()) {
  const sourceFilesByPackage = new Map();
  for (const file of listRepositoryFiles(repositoryRoot)) {
    const match = file.match(/^packages\/([^/]+)\/src\/(.+)$/);
    if (!match) continue;
    const [, packageName, sourceFile] = match;
    if (!sourceFilesByPackage.has(packageName)) {
      sourceFilesByPackage.set(packageName, []);
    }
    sourceFilesByPackage.get(packageName).push(sourceFile);
  }

  const violations = [];
  for (const [packageName, sourceFiles] of sourceFilesByPackage) {
    if (!sourceFiles.some((file) => !file.includes('/'))) continue;
    const packageJsonPath = path.join(
      repositoryRoot,
      'packages',
      packageName,
      'package.json'
    );
    let packageJson;
    try {
      packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    } catch {
      continue;
    }
    const packageRoot = path.dirname(packageJsonPath);
    const extraEntries = collectBinShimEntries(packageJson, (file) => {
      try {
        return readFileSync(path.join(packageRoot, file), 'utf8');
      } catch {
        return undefined;
      }
    });
    for (const file of findUnexportedSourceRootFiles({
      packageJson,
      sourceFiles,
      extraEntries,
    })) {
      violations.push(`packages/${packageName}/src/${file}`);
    }
  }
  return violations.sort();
}

export function run(repositoryRoot = process.cwd()) {
  const violations = findViolations(repositoryRoot);
  if (violations.length > 0) {
    console.error(
      `Source entry point validation failed: ${violations.length} file(s) directly in a package src/ directory are not package entry points:`
    );
    for (const violation of violations) console.error(`- ${violation}`);
    console.error(
      'Files directly in packages/*/src/ must back an entry in package.json (exports, main, module, types, or bin, including files a bin shim imports). Move internal modules into a subdirectory.'
    );
    return 1;
  }

  process.stdout.write(
    'Validated that every file directly in packages/*/src/ is a package entry point.\n'
  );
  return 0;
}

const executedFile = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : undefined;
if (executedFile === import.meta.url) {
  process.exitCode = run();
}
