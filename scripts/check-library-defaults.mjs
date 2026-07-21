#!/usr/bin/env node

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const repositoryRoot = process.cwd();

const defaultGroups = [
  {
    name: 'libraryDefaultLocale',
    declarations: [
      'packages/core/src/settings/settings.ts',
      'packages/format/src/settings/settings.ts',
    ],
    exceptions: new Map([
      [
        'packages/supported-locales/src/supportedLocales.ts',
        'The locale is supported-locale data, not a fallback.',
      ],
      [
        'packages/react-native/src/tools/testLocalePolyfill.ts',
        'The locale is a fixed probe used to test Intl language support.',
      ],
    ]),
  },
  {
    name: 'defaultTimeout',
    declarations: [
      'packages/core/src/settings/settings.ts',
      'packages/format/src/settings/settings.ts',
    ],
    exceptions: new Map([
      [
        'packages/core/src/translate/utils/apiRequest.ts',
        'The matching duration is a rate-limit retry delay, not a request timeout default.',
      ],
      [
        'packages/i18n/src/i18n-cache/translations-manager/utils/constants.ts',
        'The matching duration is a translation cache TTL.',
      ],
      [
        'packages/next/src/config-dir/props/defaultWithGTConfigProps.ts',
        'The matching duration is a Next.js cache TTL.',
      ],
    ]),
  },
  {
    name: 'defaultCacheUrl',
    declarations: ['packages/core/src/settings/settingsUrls.ts'],
    exceptions: new Map(),
  },
  {
    name: 'defaultBaseUrl',
    declarations: ['packages/core/src/settings/settingsUrls.ts'],
    exceptions: new Map(),
  },
  {
    name: 'defaultRuntimeApiUrl',
    declarations: ['packages/core/src/settings/settingsUrls.ts'],
    exceptions: new Map(),
  },
];

function parseSource(relativePath) {
  const absolutePath = path.join(repositoryRoot, relativePath);
  return ts.createSourceFile(
    relativePath,
    readFileSync(absolutePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );
}

function unwrapLiteral(expression) {
  if (
    ts.isAsExpression(expression) ||
    ts.isParenthesizedExpression(expression)
  ) {
    return unwrapLiteral(expression.expression);
  }
  if (ts.isStringLiteral(expression) || ts.isNumericLiteral(expression)) {
    return expression;
  }
  return undefined;
}

function readDefaultValue(relativePath, name) {
  const sourceFile = parseSource(relativePath);
  let value;

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        !ts.isIdentifier(declaration.name) ||
        declaration.name.text !== name
      ) {
        continue;
      }
      const literal = declaration.initializer
        ? unwrapLiteral(declaration.initializer)
        : undefined;
      if (!literal) {
        throw new Error(
          `${relativePath}: ${name} must be initialized with a string or number literal`
        );
      }
      value = ts.isStringLiteral(literal) ? literal.text : Number(literal.text);
    }
  }

  if (value === undefined) {
    throw new Error(`${relativePath}: missing canonical default ${name}`);
  }
  return value;
}

function collectSourceFiles(directory, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name === '__mocks__') continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(absolutePath, files);
      continue;
    }
    if (!/\.(?:[cm]?[jt]sx?)$/.test(entry.name)) continue;
    if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(entry.name)) continue;
    if (/\.d\.[cm]?ts$/.test(entry.name)) continue;
    files.push(path.relative(repositoryRoot, absolutePath));
  }
  return files;
}

function findMatchingLiterals(relativePath, expectedValue) {
  const sourceFile = parseSource(relativePath);
  const matches = [];

  function visit(node) {
    const isMatch =
      (typeof expectedValue === 'string' &&
        (ts.isStringLiteral(node) ||
          ts.isNoSubstitutionTemplateLiteral(node)) &&
        node.text === expectedValue) ||
      (typeof expectedValue === 'number' &&
        ts.isNumericLiteral(node) &&
        Number(node.text) === expectedValue);

    if (isMatch) {
      const position = sourceFile.getLineAndCharacterOfPosition(
        node.getStart()
      );
      matches.push(
        `${relativePath}:${position.line + 1}:${position.character + 1}`
      );
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return matches;
}

const resolvedDefaults = defaultGroups.map((group) => {
  const values = group.declarations.map((declaration) =>
    readDefaultValue(declaration, group.name)
  );
  if (!values.every((value) => value === values[0])) {
    throw new Error(
      `${group.name} declarations disagree: ${group.declarations
        .map(
          (declaration, index) =>
            `${declaration}=${JSON.stringify(values[index])}`
        )
        .join(', ')}`
    );
  }
  return { ...group, value: values[0] };
});

const packageSourceFiles = readdirSync(path.join(repositoryRoot, 'packages'), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .flatMap((entry) => {
    const sourceDirectory = path.join(
      repositoryRoot,
      'packages',
      entry.name,
      'src'
    );
    try {
      return collectSourceFiles(sourceDirectory);
    } catch (error) {
      if (error?.code === 'ENOENT') return [];
      throw error;
    }
  });

const violations = [];
for (const group of resolvedDefaults) {
  const allowedFiles = new Set([
    ...group.declarations,
    ...group.exceptions.keys(),
  ]);
  for (const relativePath of packageSourceFiles) {
    if (allowedFiles.has(relativePath)) continue;
    for (const location of findMatchingLiterals(relativePath, group.value)) {
      violations.push(
        `${location} repeats ${group.name} (${JSON.stringify(group.value)})`
      );
    }
  }
}

if (violations.length > 0) {
  console.error('Canonical library default validation failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  console.error(
    'Import the owning default constant. If a matching literal has a distinct meaning, add a narrow documented exception in scripts/check-library-defaults.mjs.'
  );
  process.exit(1);
}

process.stdout.write(
  `Validated ${resolvedDefaults.length} canonical library defaults across ${packageSourceFiles.length} production source files.\n`
);
