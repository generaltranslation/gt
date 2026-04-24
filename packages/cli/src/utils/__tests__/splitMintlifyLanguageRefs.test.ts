import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'node:path';
import { splitMintlifyLanguageRefs } from '../splitMintlifyLanguageRefs';
import type { Settings } from '../../types/index';
import type { RefMap } from '../resolveMintlifyRefs';

vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  },
}));

vi.mock('../../console/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the stored refMap
let mockRefMap: RefMap | null = null;
vi.mock('../../state/mintlifyRefMap.js', () => ({
  getStoredRefMap: () => mockRefMap,
  clearStoredRefMap: vi.fn(),
}));

// Mock shouldResolveRefs to return true for the test docs.json path
vi.mock('../resolveMintlifyRefs.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../resolveMintlifyRefs.js')>();
  return {
    ...actual,
    shouldResolveRefs: (filePath: string) => filePath.includes('docs.json'),
  };
});

import fs from 'node:fs';

const mockExists = vi.mocked(fs.existsSync);
const mockRead = vi.mocked(fs.readFileSync);
const mockWrite = vi.mocked(fs.writeFileSync);

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    defaultLocale: 'en',
    locales: ['en', 'es'],
    files: {
      resolvedPaths: { json: ['/project/docs.json'] },
      placeholderPaths: {},
    },
    config: '/project/gt.config.json',
    options: { mintlify: { inferTitleFromFilename: true } },
    parsingOptions: {},
    ...overrides,
  } as Settings;
}

function getWritten(filePath: string): any {
  const call = mockWrite.mock.calls.find(
    (c) => path.resolve(c[0] as string) === path.resolve(filePath)
  );
  return call ? JSON.parse(call[1] as string) : undefined;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRefMap = null;
  mockExists.mockReturnValue(true);
});

describe('splitMintlifyLanguageRefs', () => {
  it('skips when no mintlify options', async () => {
    await splitMintlifyLanguageRefs(makeSettings({ options: {} }) as Settings);
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('skips when no stored refMap', async () => {
    mockRefMap = null;
    mockRead.mockReturnValue(JSON.stringify({ navigation: {} }));
    await splitMintlifyLanguageRefs(makeSettings());
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('restores top-level $ref and splits locale entries', async () => {
    // Simulates post-merge state: docs.json is fully inlined
    const mergedDocsJson = {
      name: 'Acme',
      navigation: {
        languages: [
          {
            language: 'en',
            tabs: [
              { tab: 'Guides', groups: [{ group: 'Home', pages: ['intro'] }] },
            ],
          },
          {
            language: 'es',
            tabs: [
              {
                tab: 'Guías',
                groups: [{ group: 'Inicio', pages: ['es/intro'] }],
              },
            ],
          },
        ],
      },
      navbar: { links: [{ label: 'Support', href: '/support' }] },
    };

    mockRead.mockImplementation((p) => {
      const resolved = path.resolve(p as string);
      if (resolved === path.resolve('/project/docs.json'))
        return JSON.stringify(mergedDocsJson);
      if (resolved === path.resolve('/project/config/navigation.json'))
        return JSON.stringify(mergedDocsJson.navigation);
      throw new Error('ENOENT');
    });

    // RefMap from the read phase (before merge inlined everything)
    mockRefMap = new Map([
      [
        '/navigation',
        {
          sourceFile: path.resolve('/project/config/navigation.json'),
          refPath: './config/navigation.json',
          containingDir: '/project',
          originalContent: {},
        },
      ],
      [
        '/navbar',
        {
          sourceFile: path.resolve('/project/config/navbar.json'),
          refPath: './config/navbar.json',
          containingDir: '/project',
          originalContent: {},
        },
      ],
      [
        '/navigation/languages/0/tabs/0',
        {
          sourceFile: path.resolve('/project/config/tabs/guides.json'),
          refPath: './tabs/guides.json',
          containingDir: '/project/config',
          originalContent: {},
        },
      ],
    ]);

    await splitMintlifyLanguageRefs(makeSettings());

    // docs.json should have $ref restored for navigation and navbar
    const docsResult = getWritten('/project/docs.json');
    expect(docsResult.navigation).toEqual({
      $ref: './config/navigation.json',
    });
    expect(docsResult.navbar).toEqual({ $ref: './config/navbar.json' });

    // navigation.json: en entry should have $ref restored, es should be a $ref
    const navResult = getWritten('/project/config/navigation.json');
    expect(navResult.languages[0].tabs[0]).toEqual({
      $ref: './tabs/guides.json',
    });
    expect(navResult.languages[1]).toEqual({
      language: 'es',
      $ref: './es/navigation.json',
    });

    // es/navigation.json should have prefixed $ref for tabs
    const esNav = getWritten('/project/config/es/navigation.json');
    expect(esNav.tabs[0]).toEqual({ $ref: './es/tabs/guides.json' });

    // es locale ref file should be written with translated content
    const esGuides = getWritten('/project/config/es/tabs/guides.json');
    expect(esGuides.tab).toBe('Guías');
    expect(esGuides.groups[0].group).toBe('Inicio');
  });

  it('handles nested refs (refs within refs)', async () => {
    const mergedDocsJson = {
      navigation: {
        languages: [
          {
            language: 'en',
            tabs: [
              {
                tab: 'Guides',
                groups: [{ group: 'API', pages: ['api/users'] }],
              },
            ],
          },
          {
            language: 'es',
            tabs: [
              {
                tab: 'Guías',
                groups: [{ group: 'API', pages: ['es/api/users'] }],
              },
            ],
          },
        ],
      },
    };

    mockRead.mockImplementation((p) => {
      const resolved = path.resolve(p as string);
      if (resolved === path.resolve('/project/docs.json'))
        return JSON.stringify(mergedDocsJson);
      if (resolved === path.resolve('/project/config/navigation.json'))
        return JSON.stringify(mergedDocsJson.navigation);
      throw new Error('ENOENT');
    });

    mockRefMap = new Map([
      [
        '/navigation',
        {
          sourceFile: path.resolve('/project/config/navigation.json'),
          refPath: './config/navigation.json',
          containingDir: '/project',
          originalContent: {},
        },
      ],
      [
        '/navigation/languages/0/tabs/0',
        {
          sourceFile: path.resolve('/project/config/tabs/guides.json'),
          refPath: './tabs/guides.json',
          containingDir: '/project/config',
          originalContent: {},
        },
      ],
      [
        '/navigation/languages/0/tabs/0/groups/0',
        {
          sourceFile: path.resolve('/project/config/groups/api.json'),
          refPath: '../groups/api.json',
          containingDir: '/project/config/tabs',
          originalContent: {},
        },
      ],
    ]);

    await splitMintlifyLanguageRefs(makeSettings());

    const navResult = getWritten('/project/config/navigation.json');

    // en: nested refs restored
    expect(navResult.languages[0].tabs[0]).toEqual({
      $ref: './tabs/guides.json',
    });

    // es: entire entry is a $ref
    expect(navResult.languages[1]).toEqual({
      language: 'es',
      $ref: './es/navigation.json',
    });

    // es/navigation.json should have prefixed top-level refs
    const esNav = getWritten('/project/config/es/navigation.json');
    expect(esNav.tabs[0]).toEqual({ $ref: './es/tabs/guides.json' });

    // es guides file: nested ref keeps original path
    const esGuides = getWritten('/project/config/es/tabs/guides.json');
    expect(esGuides.groups[0]).toEqual({ $ref: '../groups/api.json' });

    // es api group should be written
    const esApi = getWritten('/project/config/es/groups/api.json');
    expect(esApi.group).toBe('API');
  });
});
