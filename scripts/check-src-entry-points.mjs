#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

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

// A `bin` that points at a checked-in shim (such as `bin/main.js`) exposes the
// built files the shim imports, so those count as entries too.
export function collectBinShimEntryPaths(packageJson, readPackageFile) {
  const entryPaths = [];
  for (const binPath of collectPaths(packageJson.bin)) {
    const normalized = path.posix.normalize(binPath);
    if (/^(dist|src)\//.test(normalized)) continue;
    const contents = readPackageFile(normalized);
    if (contents === undefined) continue;
    for (const [, specifier] of contents.matchAll(
      /(?:from|import|require\()\s*['"](\.{1,2}\/[^'"]+)['"]/g
    )) {
      entryPaths.push(
        path.posix.join(path.posix.dirname(normalized), specifier)
      );
    }
  }
  return entryPaths;
}

export function stripExtension(fileName) {
  const declaration = fileName.match(/^(.*)\.d\.[cm]?ts$/);
  if (declaration) return declaration[1];
  return fileName.replace(/\.(min\.)?[^./]+$/, '');
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
  if (segments.length > 1 && !entryPath.includes('*')) {
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

export function findUnexportedSourceRootFiles({
  packageJson,
  sourceFiles,
  extraEntryPaths = [],
}) {
  const sourceStems = sourceFiles.map((file) => ({
    file,
    stem: stripExtension(file),
  }));
  const exportedStems = [];
  for (const entryPath of [
    ...collectEntryPaths(packageJson),
    ...extraEntryPaths,
  ]) {
    const resolved = entrySourceStems(entryPath).find((stem) =>
      sourceStems.some((source) => stemMatches(stem, source.stem))
    );
    if (resolved) exportedStems.push(resolved);
  }
  return sourceStems
    .filter(({ stem }) => !stem.includes('/'))
    .filter(
      ({ stem }) =>
        !exportedStems.some((exported) => stemMatches(exported, stem))
    )
    .map(({ file }) => file)
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
  return output.split('\0').filter(Boolean);
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
    const extraEntryPaths = collectBinShimEntryPaths(packageJson, (file) => {
      try {
        return readFileSync(path.join(packageRoot, file), 'utf8');
      } catch {
        return undefined;
      }
    });
    for (const file of findUnexportedSourceRootFiles({
      packageJson,
      sourceFiles,
      extraEntryPaths,
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
