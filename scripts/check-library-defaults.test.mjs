import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import {
  defaultGroups,
  isWithinVariableDeclaration,
  normalizeRepositoryPath,
  validateRepository,
} from './check-library-defaults.mjs';

const temporaryRoots = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) =>
      rm(root, {
        recursive: true,
        force: true,
      })
    )
  );
});

async function createRepository(files) {
  const repositoryRoot = await mkdtemp(
    path.join(tmpdir(), 'check-library-defaults-')
  );
  temporaryRoots.push(repositoryRoot);

  await Promise.all(
    Object.entries(files).map(async ([relativePath, contents]) => {
      const absolutePath = path.join(repositoryRoot, relativePath);
      await mkdir(path.dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, contents);
    })
  );

  return repositoryRoot;
}

describe('validateRepository', () => {
  test('normalizes Windows paths for declaration and exception matching', () => {
    const windowsPath = path.win32.relative(
      'C:\\repo',
      'C:\\repo\\packages\\core\\src\\settings\\settings.ts'
    );

    expect(normalizeRepositoryPath(windowsPath)).toBe(
      'packages/core/src/settings/settings.ts'
    );
  });

  test('limits exceptions and declarations to their specific AST contexts', async () => {
    const repositoryRoot = await createRepository({
      'packages/core/src/settings.ts': `
        export const defaultTimeout = 60_000;
        export const accidentalDeclarationFileFallback = 60_000;
      `,
      'packages/core/src/request.ts': `
        const RATE_LIMIT_RETRY_DELAY_MS = 60_000;
        export const accidentalRequestFallback = 60_000;
      `,
    });
    const groups = [
      {
        name: 'defaultTimeout',
        declarations: ['packages/core/src/settings.ts'],
        exceptions: [
          {
            path: 'packages/core/src/request.ts',
            reason: 'This duration controls rate-limit retries.',
            matches: isWithinVariableDeclaration('RATE_LIMIT_RETRY_DELAY_MS'),
            expectedMatches: 1,
          },
        ],
      },
    ];

    const result = validateRepository({ repositoryRoot, groups });

    expect(result.violations).toHaveLength(2);
    expect(result.violations).toEqual([
      expect.stringContaining(
        'packages/core/src/request.ts:3:50 repeats defaultTimeout'
      ),
      expect.stringContaining(
        'packages/core/src/settings.ts:3:58 repeats defaultTimeout'
      ),
    ]);
  });

  test('detects no-substitution template literals', async () => {
    const repositoryRoot = await createRepository({
      'packages/core/src/settings.ts':
        "export const libraryDefaultLocale = 'en';\n",
      'packages/consumer/src/index.ts':
        'export const accidentalFallback = `en`;\n',
    });
    const groups = [
      {
        name: 'libraryDefaultLocale',
        declarations: ['packages/core/src/settings.ts'],
        exceptions: [],
      },
    ];

    const result = validateRepository({ repositoryRoot, groups });

    expect(result.violations).toEqual([
      expect.stringContaining(
        'packages/consumer/src/index.ts:1:35 repeats libraryDefaultLocale'
      ),
    ]);
  });

  test('enforces the canonical locale cookie name', async () => {
    const cookieGroup = defaultGroups.find(
      (group) => group.name === 'defaultLocaleCookieName'
    );
    expect(cookieGroup).toBeDefined();

    const repositoryRoot = await createRepository({
      'packages/react-core/src/setup/cookieNames.ts':
        "export const defaultLocaleCookieName = 'generaltranslation.locale';\n",
      'packages/consumer/src/index.ts':
        "export const cookieName = 'generaltranslation.locale';\n",
    });

    const result = validateRepository({
      repositoryRoot,
      groups: [cookieGroup],
    });

    expect(result.violations).toEqual([
      expect.stringContaining(
        'packages/consumer/src/index.ts:1:27 repeats defaultLocaleCookieName'
      ),
    ]);
  });
});
