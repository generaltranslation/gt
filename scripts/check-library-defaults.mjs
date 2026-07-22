#!/usr/bin/env node

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

function findAncestor(node, predicate) {
  let current = node;
  while (current) {
    if (predicate(current)) return current;
    current = current.parent;
  }
  return undefined;
}

export function isWithinVariableDeclaration(variableName) {
  return (node) =>
    Boolean(
      findAncestor(
        node,
        (ancestor) =>
          ts.isVariableDeclaration(ancestor) &&
          ts.isIdentifier(ancestor.name) &&
          ancestor.name.text === variableName
      )
    );
}

export function isWithinCallExpression(callText) {
  return (node, sourceFile) => {
    const call = findAncestor(node, ts.isCallExpression);
    return call?.getText(sourceFile) === callText;
  };
}

export function normalizeRepositoryPath(relativePath) {
  return relativePath.split(path.win32.sep).join(path.posix.sep);
}

export const defaultGroups = [
  {
    name: 'libraryDefaultLocale',
    declarations: [
      'packages/core/src/settings/settings.ts',
      'packages/format/src/settings/settings.ts',
    ],
    exceptions: [
      {
        path: 'packages/supported-locales/src/supportedLocales.ts',
        reason: 'The locale is supported-locale data, not a fallback.',
        matches: isWithinVariableDeclaration('supportedLocales'),
        expectedMatches: 1,
      },
      {
        path: 'packages/react-native/src/tools/testLocalePolyfill.ts',
        reason: 'The locale is a fixed Intl.DisplayNames probe.',
        matches: isWithinCallExpression("dn.of('en')"),
        expectedMatches: 1,
      },
      {
        path: 'packages/react-native/src/tools/testLocalePolyfill.ts',
        reason: 'The locale is a fixed Intl.DisplayNames probe.',
        matches: isWithinCallExpression(
          "new Intl.DisplayNames(locale, { type: 'language' }).of('en')"
        ),
        expectedMatches: 1,
      },
    ],
  },
  {
    name: 'defaultTimeout',
    declarations: [
      'packages/core/src/settings/settings.ts',
      'packages/format/src/settings/settings.ts',
    ],
    exceptions: [
      {
        path: 'packages/core/src/translate/utils/apiRequest.ts',
        reason:
          'The matching duration is a rate-limit retry delay, not a request timeout default.',
        matches: isWithinVariableDeclaration('RATE_LIMIT_RETRY_DELAY_MS'),
        expectedMatches: 1,
      },
      {
        path: 'packages/i18n/src/i18n-cache/translations-manager/utils/constants.ts',
        reason: 'The matching duration is a translation cache TTL.',
        matches: isWithinVariableDeclaration('DEFAULT_CACHE_EXPIRY_TIME'),
        expectedMatches: 1,
      },
      {
        path: 'packages/next/src/config-dir/props/defaultWithGTConfigProps.ts',
        reason: 'The matching duration is a Next.js cache TTL.',
        matches: isWithinVariableDeclaration('defaultCacheExpiryTime'),
        expectedMatches: 1,
      },
    ],
  },
  {
    name: 'defaultCacheUrl',
    declarations: ['packages/core/src/settings/settingsUrls.ts'],
    exceptions: [],
  },
  {
    name: 'defaultBaseUrl',
    declarations: ['packages/core/src/settings/settingsUrls.ts'],
    exceptions: [],
  },
  {
    name: 'defaultRuntimeApiUrl',
    declarations: ['packages/core/src/settings/settingsUrls.ts'],
    exceptions: [],
  },
  {
    name: 'defaultLocaleCookieName',
    declarations: ['packages/react-core/src/setup/cookieNames.ts'],
    exceptions: [],
  },
  {
    name: 'defaultRegionCookieName',
    declarations: ['packages/react-core/src/setup/cookieNames.ts'],
    exceptions: [],
  },
  {
    name: 'defaultEnableI18nCookieName',
    declarations: ['packages/react-core/src/setup/cookieNames.ts'],
    exceptions: [],
  },
  {
    name: 'defaultResetLocaleCookieName',
    declarations: ['packages/react-core/src/setup/cookieNames.ts'],
    exceptions: [],
  },
  {
    name: 'defaultLocaleRoutingEnabledCookieName',
    declarations: ['packages/next/src/utils/cookies.ts'],
    exceptions: [],
  },
  {
    name: 'defaultReferrerLocaleCookieName',
    declarations: ['packages/next/src/utils/cookies.ts'],
    exceptions: [],
  },
  {
    name: 'defaultLocaleHeaderName',
    declarations: ['packages/next/src/utils/headers.ts'],
    exceptions: [],
  },
];

function parseSource(repositoryRoot, relativePath) {
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

function readDefaultValue(repositoryRoot, relativePath, name) {
  const sourceFile = parseSource(repositoryRoot, relativePath);
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

function collectSourceFiles(repositoryRoot, directory, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name === '__mocks__') continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(repositoryRoot, absolutePath, files);
      continue;
    }
    if (!/\.(?:[cm]?[jt]sx?)$/.test(entry.name)) continue;
    if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(entry.name)) continue;
    if (/\.d\.[cm]?ts$/.test(entry.name)) continue;
    files.push(
      normalizeRepositoryPath(path.relative(repositoryRoot, absolutePath))
    );
  }
  return files;
}

function findMatchingLiterals(repositoryRoot, relativePath, expectedValue) {
  const sourceFile = parseSource(repositoryRoot, relativePath);
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
      matches.push({
        node,
        sourceFile,
        location: `${relativePath}:${position.line + 1}:${position.character + 1}`,
      });
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return matches;
}

export function validateRepository({
  repositoryRoot = process.cwd(),
  groups = defaultGroups,
} = {}) {
  const resolvedDefaults = groups.map((group) => {
    const values = group.declarations.map((declaration) =>
      readDefaultValue(repositoryRoot, declaration, group.name)
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

  const packageSourceFiles = readdirSync(
    path.join(repositoryRoot, 'packages'),
    { withFileTypes: true }
  )
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const sourceDirectory = path.join(
        repositoryRoot,
        'packages',
        entry.name,
        'src'
      );
      try {
        return collectSourceFiles(repositoryRoot, sourceDirectory);
      } catch (error) {
        if (error?.code === 'ENOENT') return [];
        throw error;
      }
    });

  const violations = [];
  for (const group of resolvedDefaults) {
    const declarationFiles = new Set(group.declarations);
    const declarationMatch = isWithinVariableDeclaration(group.name);
    const exceptionCounts = new Map(
      group.exceptions.map((exception) => [exception, 0])
    );

    for (const relativePath of packageSourceFiles) {
      for (const match of findMatchingLiterals(
        repositoryRoot,
        relativePath,
        group.value
      )) {
        if (
          declarationFiles.has(relativePath) &&
          declarationMatch(match.node)
        ) {
          continue;
        }

        const exception = group.exceptions.find(
          (candidate) =>
            candidate.path === relativePath &&
            candidate.matches(match.node, match.sourceFile)
        );
        if (exception) {
          exceptionCounts.set(exception, exceptionCounts.get(exception) + 1);
          continue;
        }

        violations.push(
          `${match.location} repeats ${group.name} (${JSON.stringify(group.value)})`
        );
      }
    }

    for (const [exception, count] of exceptionCounts) {
      if (!exception.reason) {
        throw new Error(
          `${group.name}: exception for ${exception.path} needs a reason`
        );
      }
      if (count !== exception.expectedMatches) {
        throw new Error(
          `${group.name}: exception for ${exception.path} expected ${exception.expectedMatches} matching literal(s), found ${count}`
        );
      }
    }
  }

  return {
    defaultCount: resolvedDefaults.length,
    sourceFileCount: packageSourceFiles.length,
    violations,
  };
}

export function run(repositoryRoot = process.cwd()) {
  const result = validateRepository({ repositoryRoot });
  if (result.violations.length > 0) {
    console.error('Canonical library default validation failed:');
    for (const violation of result.violations) console.error(`- ${violation}`);
    console.error(
      'Import the owning default constant. If a matching literal has a distinct meaning, add a narrow documented exception in scripts/check-library-defaults.mjs.'
    );
    return 1;
  }

  process.stdout.write(
    `Validated ${result.defaultCount} canonical library defaults across ${result.sourceFileCount} production source files.\n`
  );
  return 0;
}

const executedFile = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : undefined;
if (executedFile === import.meta.url) {
  process.exitCode = run();
}
