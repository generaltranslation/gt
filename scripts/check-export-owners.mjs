#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { normalizeRepositoryPath } from './check-library-defaults.mjs';
import { getPackageName } from './check-reexports.mjs';

// The two "Imports and re-exports" rules (AGENTS.md) that `check:reexports`
// cannot check from source: they need the built declarations to resolve a
// re-exported name to the package that defines it.

// The same declaration exported from more than one subpath of a package.
export const duplicateExceptions = [
  {
    packageName: 'generaltranslation',
    subpaths: ['.', './internal'],
    names: [
      'GTIntl',
      'formatCurrency',
      'formatCutoff',
      'formatDateTime',
      'formatList',
      'formatListToParts',
      'formatMessage',
      'formatNum',
      'formatRelativeTime',
      'formatRelativeTimeFromDate',
    ],
    reason:
      'Users import the resolving formatters from the root; sibling packages import them from /internal, which loads without the API client.',
  },
  {
    packageName: '@generaltranslation/react-core',
    subpaths: ['./components', './components-rsc'],
    names: '*',
    reason:
      'Server-safe components are part of both the client and the RSC component entries.',
  },
  {
    packageName: 'gt-rrweb',
    subpaths: ['.', './harvest'],
    names: ['HarvestOptions', 'LocaleTextOverlay', 'TranslationsLoader'],
    reason: 'Developed on main, which has no single-subpath policy.',
  },
];

// First-party imports allowed to go through a package that is not the owner.
export const importExceptions = [
  {
    importers: ['gt-next', 'gt-tanstack-start'],
    via: 'gt-react',
    owner: '@generaltranslation/react-core',
    reason:
      "gt-react's entries own the 'use client' directives and react-server conditions of the components and hooks they re-export.",
  },
];

const ignoredDirectories = new Set([
  'node_modules',
  'dist',
  '__fixtures__',
  'fixtures',
]);
const sourceFilePattern = /\.(?:[cm]?[jt]sx?)$/;

// Every declaration file a subpath can resolve to, across export conditions
// (react-server, browser, require, ...).
function collectDeclarationTargets(value, targets = new Set()) {
  if (typeof value === 'string') {
    if (/\.d\.[cm]?ts$/.test(value)) targets.add(value);
  } else if (value && typeof value === 'object') {
    for (const nested of Object.values(value)) {
      collectDeclarationTargets(nested, targets);
    }
  }
  return targets;
}

export function readWorkspace(repositoryRoot) {
  const packages = [];
  const packagesDirectory = path.join(repositoryRoot, 'packages');
  for (const directory of readdirSync(packagesDirectory).sort()) {
    const manifestPath = path.join(
      packagesDirectory,
      directory,
      'package.json'
    );
    if (!existsSync(manifestPath)) continue;
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const packageDirectory = realpathSync(
      path.join(packagesDirectory, directory)
    );
    const entries = [];
    const exportsMap =
      manifest.exports && typeof manifest.exports === 'object'
        ? manifest.exports
        : {};
    for (const [subpath, value] of Object.entries(exportsMap)) {
      if (!subpath.startsWith('.') || subpath.includes('*')) continue;
      if (subpath === './package.json' || subpath.endsWith('.json')) continue;
      for (const target of collectDeclarationTargets(value)) {
        const file = path.join(packageDirectory, target);
        entries.push({ subpath, file: existsSync(file) ? file : undefined });
      }
    }
    packages.push({
      name: manifest.name,
      directory,
      packageDirectory,
      entries,
    });
  }
  return packages;
}

function collectSourceFiles(directory, files = []) {
  if (!existsSync(directory)) return files;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) collectSourceFiles(absolutePath, files);
    else if (
      sourceFilePattern.test(entry.name) &&
      !/\.d\.[cm]?ts$/.test(entry.name)
    ) {
      files.push(absolutePath);
    }
  }
  return files;
}

// Names imported or re-exported from each module specifier.
function collectNamedImports(file) {
  const sourceFile = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );
  const imports = [];
  for (const statement of sourceFile.statements) {
    let bindings;
    if (ts.isImportDeclaration(statement)) {
      bindings = statement.importClause?.namedBindings;
      if (!bindings || !ts.isNamedImports(bindings)) continue;
    } else if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      bindings = statement.exportClause;
    } else {
      continue;
    }
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(
      statement.getStart()
    );
    for (const element of bindings.elements) {
      imports.push({
        specifier: statement.moduleSpecifier.text,
        name: (element.propertyName ?? element.name).text,
        line: line + 1,
        character: character + 1,
      });
    }
  }
  return imports;
}

export function validateWorkspace({
  repositoryRoot = process.cwd(),
  duplicates = duplicateExceptions,
  imports = importExceptions,
} = {}) {
  for (const exception of [...duplicates, ...imports]) {
    if (!exception.reason) throw new Error('Every exception needs a reason');
  }
  const packages = readWorkspace(repositoryRoot);
  // Built when every subpath has at least one declaration file.
  const builtPackages = packages.filter(
    (pkg) =>
      pkg.entries.length > 0 &&
      pkg.entries.every(({ subpath }) =>
        pkg.entries.some((entry) => entry.subpath === subpath && entry.file)
      )
  );
  const skippedPackages = packages
    .filter((pkg) => pkg.entries.length > 0 && !builtPackages.includes(pkg))
    .map((pkg) => pkg.name);

  const program = ts.createProgram(
    builtPackages.flatMap((pkg) =>
      pkg.entries.flatMap((entry) => (entry.file ? [entry.file] : []))
    ),
    {
      allowJs: false,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      noEmit: true,
      skipLibCheck: true,
      target: ts.ScriptTarget.ESNext,
    }
  );
  const checker = program.getTypeChecker();
  const ownerOf = (fileName) => {
    const realFile = realpathSync(fileName);
    return packages.find((pkg) =>
      realFile.startsWith(`${pkg.packageDirectory}${path.sep}`)
    )?.name;
  };

  // One list per declaration file, and the owners each import specifier's
  // names resolve to across its export conditions:
  // `${package}${subpath}` -> name -> Set<owner>.
  const exportLists = [];
  const exportsBySpecifier = new Map();
  for (const pkg of builtPackages) {
    for (const { subpath, file } of pkg.entries) {
      if (!file) continue;
      const sourceFile = program.getSourceFile(file);
      const moduleSymbol =
        sourceFile && checker.getSymbolAtLocation(sourceFile);
      if (!moduleSymbol) continue;
      const names = new Map();
      for (const exported of checker.getExportsOfModule(moduleSymbol)) {
        let target = exported;
        if (exported.flags & ts.SymbolFlags.Alias) {
          target = checker.getAliasedSymbol(exported);
        }
        const declaration = target.declarations?.[0];
        if (!declaration) continue;
        names.set(exported.getName(), {
          owner: ownerOf(declaration.getSourceFile().fileName),
          declaration,
        });
      }
      exportLists.push({ packageName: pkg.name, subpath, names });
      const specifier =
        subpath === '.' ? pkg.name : `${pkg.name}${subpath.slice(1)}`;
      const merged = exportsBySpecifier.get(specifier) ?? { names: new Map() };
      exportsBySpecifier.set(specifier, merged);
      for (const [name, { owner }] of names) {
        if (!owner) continue;
        const owners = merged.names.get(name) ?? new Set();
        merged.names.set(name, owners.add(owner));
      }
    }
  }

  const violations = [];

  // Keyed by declaration, so a renamed export of the same declaration counts.
  const exportsByDeclaration = new Map();
  for (const { packageName, subpath, names } of exportLists) {
    for (const [name, { declaration }] of names) {
      if (name === 'default') continue;
      const byDeclaration = exportsByDeclaration.get(packageName) ?? new Map();
      exportsByDeclaration.set(packageName, byDeclaration);
      const entries = byDeclaration.get(declaration) ?? [];
      byDeclaration.set(declaration, [...entries, { subpath, name }]);
    }
  }
  for (const [packageName, byDeclaration] of exportsByDeclaration) {
    for (const entries of byDeclaration.values()) {
      const subpaths = [...new Set(entries.map((entry) => entry.subpath))];
      if (subpaths.length < 2) continue;
      const names = [...new Set(entries.map((entry) => entry.name))];
      const allowed = duplicates.some(
        (exception) =>
          exception.packageName === packageName &&
          subpaths.every((subpath) => exception.subpaths.includes(subpath)) &&
          (exception.names === '*' ||
            names.every((name) => exception.names.includes(name)))
      );
      if (!allowed) {
        const exported = entries
          .map(({ subpath, name }) => `${name} from ${subpath}`)
          .join(' and ');
        violations.push(
          `${packageName} exports one declaration as ${exported}; export it from one subpath`
        );
      }
    }
  }

  for (const pkg of packages) {
    for (const file of collectSourceFiles(
      path.join(pkg.packageDirectory, 'src')
    )) {
      for (const { specifier, name, line, character } of collectNamedImports(
        file
      )) {
        const owners = exportsBySpecifier.get(specifier)?.names.get(name);
        const via = getPackageName(specifier);
        for (const owner of owners ?? []) {
          if (owner === via || owner === pkg.name) continue;
          const allowed = imports.some(
            (exception) =>
              exception.via === via &&
              exception.owner === owner &&
              exception.importers.includes(pkg.name)
          );
          if (allowed) continue;
          const location = `${normalizeRepositoryPath(
            path.relative(realpathSync(repositoryRoot), file)
          )}:${line}:${character}`;
          violations.push(
            `${location} imports ${name} from '${specifier}', but ${owner} defines it; import it from ${owner}`
          );
        }
      }
    }
  }

  return {
    checkedPackageCount: builtPackages.length,
    skippedPackages,
    violations: [...new Set(violations)].sort(),
  };
}

export function run(repositoryRoot = process.cwd()) {
  const result = validateWorkspace({ repositoryRoot });
  if (result.violations.length > 0) {
    console.error('Export owner validation failed:');
    for (const violation of result.violations) console.error(`- ${violation}`);
    console.error(
      'Export each symbol from one subpath, and import it from the package that defines it (see "Imports and re-exports" in AGENTS.md). Exceptions live in scripts/check-export-owners.mjs.'
    );
    return 1;
  }
  const skipped =
    result.skippedPackages.length > 0
      ? `; skipped ${result.skippedPackages.length} without built declarations (${result.skippedPackages.join(', ')})`
      : '';
  process.stdout.write(
    `Validated export owners across ${result.checkedPackageCount} built packages${skipped}.\n`
  );
  return 0;
}

const executedFile = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : undefined;
if (executedFile === import.meta.url) {
  process.exitCode = run();
}
