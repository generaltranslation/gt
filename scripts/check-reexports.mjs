#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

// Facade packages (AGENTS.md "Imports and re-exports") may re-export these
// owner packages from their entry files for end users. Every other entry
// re-exports only its own package's modules. Core's facade symbols are
// re-exported from their owners, so format and api count as core.
const coreTargets = [
  'generaltranslation',
  '@generaltranslation/format',
  '@generaltranslation/api',
];
const reactFrameworkTargets = [
  '@generaltranslation/react-core',
  'gt-i18n',
  ...coreTargets,
];
// gt-react's export conditions pick its react-server or client build, so
// framework packages re-export RSC-conditional components from gt-react.
const reactConditionalTargets = ['gt-react', ...reactFrameworkTargets];

export const facadeReexportTargets = {
  generaltranslation: ['@generaltranslation/format', '@generaltranslation/api'],
  'gt-i18n': coreTargets,
  'gt-node': ['gt-i18n', ...coreTargets],
  'gt-react': reactFrameworkTargets,
  'gt-react-native': reactFrameworkTargets,
  'gt-next': reactConditionalTargets,
  'gt-tanstack-start': reactConditionalTargets,
  'gt-svelte': ['gt-i18n', ...coreTargets],
  'gt-sanity': [
    '@sanity/document-internationalization',
    'sanity-plugin-internationalized-array',
  ],
  'gtx-cli': ['gt'],
};

// Non-entry source files that may re-export like an entry file.
export const entryExceptions = [
  {
    path: 'packages/tanstack-start/src/index.shared.ts',
    reason: 'Shared body of the index.client and index.server entries.',
  },
  {
    path: 'packages/next/src/utils/client-boundary.tsx',
    reason:
      "'use client' shim so server entries can render gt-react client components.",
  },
];

const ignoredDirectories = new Set([
  '__tests__',
  '__mocks__',
  'dist',
  'node_modules',
]);
const generatedDirectories = new Set([
  'packages/api/src/generated',
  'packages/cli/src/generated',
]);
const sourceFilePattern = /\.(?:[cm]?[jt]sx?)$/;
const sourceExtensions = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs'];

export function normalizeRepositoryPath(relativePath) {
  return relativePath.split(path.win32.sep).join(path.posix.sep);
}

export function getPackageName(specifier) {
  if (specifier.startsWith('.') || specifier.startsWith('/')) return undefined;
  const segments = specifier.split('/');
  return specifier.startsWith('@')
    ? segments.slice(0, 2).join('/')
    : segments[0];
}

function collectStrings(value, strings = []) {
  if (typeof value === 'string') strings.push(value);
  else if (value && typeof value === 'object') {
    for (const nested of Object.values(value)) collectStrings(nested, strings);
  }
  return strings;
}

function resolveSourceFile(packageDirectory, candidate) {
  for (const extension of ['', ...sourceExtensions]) {
    const file = `${candidate}${extension}`;
    if (
      sourceFilePattern.test(file) &&
      existsSync(path.join(packageDirectory, file))
    ) {
      return file;
    }
  }
  return undefined;
}

// Maps a published file (./dist/index.d.mts, ./src/index.tsx) to its source.
function resolveExportTarget(packageDirectory, target) {
  const relative = target.replace(/^\.\//, '');
  if (relative.startsWith('src/')) {
    return resolveSourceFile(packageDirectory, relative);
  }
  if (!relative.startsWith('dist/')) return undefined;
  const stem = relative
    .replace(/^dist\//, 'src/')
    .replace(/(?:\.d)?\.[cm]?[jt]sx?$/, '');
  return (
    resolveSourceFile(packageDirectory, stem) ??
    resolveSourceFile(packageDirectory, `${stem}/index`)
  );
}

// A literal is an entry only inside an entry/entries property, an *entry or
// *entries variable, or the entry argument of createTsdownConfig.
function isInEntryPosition(node) {
  for (let child = node; child.parent; child = child.parent) {
    const parent = child.parent;
    if (
      (ts.isPropertyAssignment(parent) &&
        /^entr(?:y|ies)$/.test(parent.name.text)) ||
      (ts.isVariableDeclaration(parent) &&
        ts.isIdentifier(parent.name) &&
        /entr(?:y|ies)$/i.test(parent.name.text)) ||
      (ts.isCallExpression(parent) &&
        parent.expression.getText() === 'createTsdownConfig' &&
        parent.arguments[0] === child)
    ) {
      return true;
    }
  }
  return false;
}

// Explicit src/ entries in tsdown.config.mts; globs are not entries.
function readTsdownEntries(packageDirectory) {
  const configPath = path.join(packageDirectory, 'tsdown.config.mts');
  if (!existsSync(configPath)) return [];
  const sourceFile = ts.createSourceFile(
    configPath,
    readFileSync(configPath, 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );
  const entries = [];
  function visit(node) {
    if (
      ts.isStringLiteral(node) &&
      /^src\/[^*!{}]+$/.test(node.text) &&
      sourceFilePattern.test(node.text) &&
      isInEntryPosition(node) &&
      existsSync(path.join(packageDirectory, node.text))
    ) {
      entries.push(node.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return entries;
}

export function readPackageEntries(repositoryRoot, packageDirectoryName) {
  const packageDirectory = path.join(
    repositoryRoot,
    'packages',
    packageDirectoryName
  );
  const manifest = JSON.parse(
    readFileSync(path.join(packageDirectory, 'package.json'), 'utf8')
  );
  const targets = collectStrings([
    manifest.exports,
    manifest.main,
    manifest.module,
    manifest.types,
  ]);
  const entries = new Set(readTsdownEntries(packageDirectory));
  for (const target of targets) {
    const entry = resolveExportTarget(packageDirectory, target);
    if (entry) entries.add(entry);
  }
  return {
    name: manifest.name,
    entries: [...entries].map((entry) =>
      normalizeRepositoryPath(
        path.join('packages', packageDirectoryName, entry)
      )
    ),
  };
}

function collectSourceFiles(repositoryRoot, directory, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    const relativePath = normalizeRepositoryPath(
      path.relative(repositoryRoot, absolutePath)
    );
    if (entry.isDirectory()) {
      if (!generatedDirectories.has(relativePath)) {
        collectSourceFiles(repositoryRoot, absolutePath, files);
      }
      continue;
    }
    if (!sourceFilePattern.test(entry.name)) continue;
    if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(entry.name)) continue;
    if (/\.d\.[cm]?ts$/.test(entry.name)) continue;
    files.push(relativePath);
  }
  return files;
}

// Maps each imported local binding to its module specifier.
function collectImportedBindings(sourceFile) {
  const imported = new Map();
  for (const statement of sourceFile.statements) {
    if (
      ts.isImportEqualsDeclaration(statement) &&
      ts.isExternalModuleReference(statement.moduleReference)
    ) {
      imported.set(
        statement.name.text,
        statement.moduleReference.expression.text
      );
      continue;
    }
    if (!ts.isImportDeclaration(statement) || !statement.importClause) continue;
    const specifier = statement.moduleSpecifier.text;
    const { name, namedBindings } = statement.importClause;
    if (name) imported.set(name.text, specifier);
    if (namedBindings && ts.isNamespaceImport(namedBindings)) {
      imported.set(namedBindings.name.text, specifier);
    } else if (namedBindings) {
      for (const element of namedBindings.elements) {
        imported.set(element.name.text, specifier);
      }
    }
  }
  return imported;
}

// Returns every re-export in a file: { specifier, names, location }.
export function findReexports(relativePath, sourceText) {
  const sourceFile = ts.createSourceFile(
    relativePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const imported = collectImportedBindings(sourceFile);
  const reexports = [];
  const locate = (node) => {
    const position = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    return `${relativePath}:${position.line + 1}:${position.character + 1}`;
  };

  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement)) {
      if (statement.moduleSpecifier) {
        reexports.push({
          specifier: statement.moduleSpecifier.text,
          names: statement.exportClause
            ? ts.isNamespaceExport(statement.exportClause)
              ? [`* as ${statement.exportClause.name.text}`]
              : statement.exportClause.elements.map((e) => e.name.text)
            : ['*'],
          location: locate(statement),
        });
        continue;
      }
      if (
        !statement.exportClause ||
        !ts.isNamedExports(statement.exportClause)
      ) {
        continue;
      }
      for (const element of statement.exportClause.elements) {
        const localName = (element.propertyName ?? element.name).text;
        if (!imported.has(localName)) continue;
        reexports.push({
          specifier: imported.get(localName),
          names: [element.name.text],
          location: locate(element),
        });
      }
    } else if (
      ts.isImportEqualsDeclaration(statement) &&
      statement.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
      )
    ) {
      // export import x = require('y') or export import X = Imported.Y
      let reference = statement.moduleReference;
      while (ts.isQualifiedName(reference)) reference = reference.left;
      const specifier = ts.isExternalModuleReference(reference)
        ? reference.expression.text
        : imported.get(reference.text);
      if (specifier) {
        reexports.push({
          specifier,
          names: [statement.name.text],
          location: locate(statement),
        });
      }
    } else if (
      ts.isExportAssignment(statement) &&
      ts.isIdentifier(statement.expression) &&
      imported.has(statement.expression.text)
    ) {
      reexports.push({
        specifier: imported.get(statement.expression.text),
        names: ['default'],
        location: locate(statement),
      });
    }
  }
  return reexports;
}

export function validateRepository({
  repositoryRoot = process.cwd(),
  facades = facadeReexportTargets,
  exceptions = entryExceptions,
} = {}) {
  for (const exception of exceptions) {
    if (!exception.reason) {
      throw new Error(`Entry exception for ${exception.path} needs a reason`);
    }
    if (!existsSync(path.join(repositoryRoot, exception.path))) {
      throw new Error(`Entry exception ${exception.path} does not exist`);
    }
  }
  const exceptionPaths = new Set(exceptions.map((exception) => exception.path));

  const packageDirectories = readdirSync(
    path.join(repositoryRoot, 'packages'),
    {
      withFileTypes: true,
    }
  )
    .filter(
      (entry) =>
        entry.isDirectory() &&
        existsSync(
          path.join(repositoryRoot, 'packages', entry.name, 'package.json')
        )
    )
    .map((entry) => entry.name)
    .sort();

  const violations = [];
  let entryCount = 0;
  let sourceFileCount = 0;

  for (const directoryName of packageDirectories) {
    const sourceDirectory = path.join(
      repositoryRoot,
      'packages',
      directoryName,
      'src'
    );
    if (!existsSync(sourceDirectory)) continue;
    const { name: packageName, entries } = readPackageEntries(
      repositoryRoot,
      directoryName
    );
    const entryFiles = new Set(entries);
    entryCount += entryFiles.size;
    const allowedTargets = new Set(facades[packageName] ?? []);

    for (const relativePath of collectSourceFiles(
      repositoryRoot,
      sourceDirectory
    )) {
      sourceFileCount += 1;
      const isEntry =
        entryFiles.has(relativePath) || exceptionPaths.has(relativePath);
      const reexports = findReexports(
        relativePath,
        readFileSync(path.join(repositoryRoot, relativePath), 'utf8')
      );

      for (const reexport of reexports) {
        const names = reexport.names.join(', ');
        if (!isEntry) {
          violations.push(
            `${reexport.location} re-exports ${names} from '${reexport.specifier}' outside a package entry`
          );
          continue;
        }
        const targetPackage = getPackageName(reexport.specifier);
        if (
          !targetPackage &&
          !path.posix
            .join(path.posix.dirname(relativePath), reexport.specifier)
            .startsWith(`packages/${directoryName}/`)
        ) {
          violations.push(
            `${reexport.location} re-exports ${names} from '${reexport.specifier}', a path outside ${packageName}; re-export the owner package entry instead`
          );
        } else if (
          targetPackage &&
          targetPackage !== packageName &&
          !allowedTargets.has(targetPackage)
        ) {
          violations.push(
            `${reexport.location} re-exports ${names} from '${reexport.specifier}', but ${packageName} is not a facade for ${targetPackage}`
          );
        }
      }
    }
  }

  return { entryCount, sourceFileCount, violations };
}

export function run(repositoryRoot = process.cwd()) {
  const result = validateRepository({ repositoryRoot });
  if (result.violations.length > 0) {
    console.error('Re-export validation failed:');
    for (const violation of result.violations) console.error(`- ${violation}`);
    console.error(
      'Import each symbol from the file that defines it, or from the owner package entry. Only package entry files re-export, and only facade packages re-export other packages (see "Imports and re-exports" in AGENTS.md).'
    );
    return 1;
  }

  process.stdout.write(
    `Validated re-exports across ${result.sourceFileCount} production source files (${result.entryCount} package entry files).\n`
  );
  return 0;
}

const executedFile = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : undefined;
if (executedFile === import.meta.url) {
  process.exitCode = run();
}
