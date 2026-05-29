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

// Mock validateJsonSchema to return the schema for docs.json
vi.mock('../../formats/json/utils.js', () => ({
  validateJsonSchema: (_options: unknown, filePath: string) => {
    if (filePath.includes('docs.json')) {
      return {
        resolveRefs: true,
        composite: {
          '$.navigation.languages': {
            type: 'array',
            key: '$.language',
            splitEntries: true,
            include: ['$..group', '$..tab'],
          },
        },
      };
    }
    return null;
  },
}));

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
    options: {
      jsonSchema: {
        './docs.json': {
          resolveRefs: true,
          composite: {
            '$.navigation.languages': {
              type: 'array',
              key: '$.language',
              splitEntries: true,
              include: ['$..group', '$..tab'],
            },
          },
        },
      },
    },
    parsingOptions: {},
    ...overrides,
  } as Settings;
}

function getWritten(filePath: string): unknown {
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
  it('skips when no jsonSchema config', async () => {
    await splitMintlifyLanguageRefs(makeSettings({ options: {} }) as Settings);
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('skips splitting when no languages array exists', async () => {
    mockRefMap = null;
    mockRead.mockReturnValue(
      JSON.stringify({ navigation: { groups: [{ group: 'Home' }] } })
    );
    await splitMintlifyLanguageRefs(makeSettings());
    // No locale ref files created — only a write-back of the original file
    const localeFiles = mockWrite.mock.calls.filter((c) =>
      (c[0] as string).includes('/es/')
    );
    expect(localeFiles).toHaveLength(0);
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

    // es/navigation.json should have original $ref paths (not prefixed —
    // the file is already in the locale dir, so relative resolution works)
    const esNav = getWritten('/project/config/es/navigation.json');
    expect(esNav.tabs[0]).toEqual({ $ref: './tabs/guides.json' });

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

    // es/navigation.json should have original $ref paths (not prefixed)
    const esNav = getWritten('/project/config/es/navigation.json');
    expect(esNav.tabs[0]).toEqual({ $ref: './tabs/guides.json' });

    // es guides file: nested ref keeps original path
    const esGuides = getWritten('/project/config/es/tabs/guides.json');
    expect(esGuides.groups[0]).toEqual({ $ref: '../groups/api.json' });

    // es api group should be written
    const esApi = getWritten('/project/config/es/groups/api.json');
    expect(esApi.group).toBe('API');
  });

  it('handles multiple target locales', async () => {
    const mergedDocsJson = {
      navigation: {
        languages: [
          { language: 'en', tabs: [{ tab: 'Guides', groups: [] }] },
          { language: 'es', tabs: [{ tab: 'Guías', groups: [] }] },
          { language: 'fr', tabs: [{ tab: 'Guides (fr)', groups: [] }] },
          { language: 'de', tabs: [{ tab: 'Anleitungen', groups: [] }] },
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
    ]);

    await splitMintlifyLanguageRefs(
      makeSettings({ locales: ['en', 'es', 'fr', 'de'] })
    );

    const navResult = getWritten('/project/config/navigation.json');

    // en stays inline
    expect(navResult.languages[0].language).toBe('en');
    expect(navResult.languages[0].tabs).toBeDefined();

    // All non-default locales get their own ref file
    expect(navResult.languages[1]).toEqual({
      language: 'es',
      $ref: './es/navigation.json',
    });
    expect(navResult.languages[2]).toEqual({
      language: 'fr',
      $ref: './fr/navigation.json',
    });
    expect(navResult.languages[3]).toEqual({
      language: 'de',
      $ref: './de/navigation.json',
    });

    // Each locale file should have translated content
    const esNav = getWritten('/project/config/es/navigation.json');
    expect(esNav.tabs[0].tab).toBe('Guías');
    const frNav = getWritten('/project/config/fr/navigation.json');
    expect(frNav.tabs[0].tab).toBe('Guides (fr)');
    const deNav = getWritten('/project/config/de/navigation.json');
    expect(deNav.tabs[0].tab).toBe('Anleitungen');
  });

  it('handles inline navigation (no $ref in source)', async () => {
    const mergedDocsJson = {
      navigation: {
        languages: [
          { language: 'en', groups: [{ group: 'Home', pages: ['index'] }] },
          {
            language: 'es',
            groups: [{ group: 'Inicio', pages: ['es/index'] }],
          },
        ],
      },
    };

    mockRead.mockImplementation((p) => {
      if (path.resolve(p as string) === path.resolve('/project/docs.json'))
        return JSON.stringify(mergedDocsJson);
      throw new Error('ENOENT');
    });

    // No $ref entries — navigation is inline in docs.json
    mockRefMap = new Map();

    await splitMintlifyLanguageRefs(makeSettings());

    // Even without $ref, locale entries should be split into their own files
    const docsResult = getWritten('/project/docs.json');
    expect(docsResult.navigation.languages[0].language).toBe('en');
    expect(docsResult.navigation.languages[0].groups).toBeDefined();
    expect(docsResult.navigation.languages[1]).toEqual({
      language: 'es',
      $ref: './es/docs.json',
    });

    const esNav = getWritten('/project/es/docs.json');
    expect(esNav.groups[0].group).toBe('Inicio');
  });

  it('handles default locale not being first in the array', async () => {
    const mergedDocsJson = {
      navigation: {
        languages: [
          { language: 'es', tabs: [{ tab: 'Guías', groups: [] }] },
          { language: 'en', tabs: [{ tab: 'Guides', groups: [] }] },
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
        '/navigation/languages/1/tabs/0',
        {
          sourceFile: path.resolve('/project/config/tabs/guides.json'),
          refPath: './tabs/guides.json',
          containingDir: '/project/config',
          originalContent: {},
        },
      ],
    ]);

    await splitMintlifyLanguageRefs(makeSettings());

    const navResult = getWritten('/project/config/navigation.json');

    // es (index 0) gets a ref file since it's not default
    expect(navResult.languages[0]).toEqual({
      language: 'es',
      $ref: './es/navigation.json',
    });

    // en (index 1, default) keeps inline with restored $ref
    expect(navResult.languages[1].language).toBe('en');
    expect(navResult.languages[1].tabs[0]).toEqual({
      $ref: './tabs/guides.json',
    });
  });

  it('idempotent on re-run (locale ref files already exist)', async () => {
    // Simulates state after a previous run: docs.json is inlined by merge,
    // but the refMap still has the original topology from the read phase.
    const mergedDocsJson = {
      navigation: {
        languages: [
          { language: 'en', tabs: [{ tab: 'Guides', groups: [] }] },
          { language: 'es', tabs: [{ tab: 'Guías', groups: [] }] },
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
    ]);

    await splitMintlifyLanguageRefs(makeSettings());

    const navResult = getWritten('/project/config/navigation.json');

    // Should produce the same structure regardless of initial state
    expect(navResult.languages[0].language).toBe('en');
    expect(navResult.languages[0].tabs).toBeDefined();
    expect(navResult.languages[1]).toEqual({
      language: 'es',
      $ref: './es/navigation.json',
    });

    const esNav = getWritten('/project/config/es/navigation.json');
    expect(esNav.tabs[0].tab).toBe('Guías');
  });

  it('handles per-entry $ref language entries (ref on each language, not the container)', async () => {
    // Auth0-style source: docs.json has an inline navigation/languages array
    // where each *entry* is a $ref (the en entry is `{ $ref: config/nav.json }`),
    // and nav.json itself has nested $refs to navigation/*.json. After merge the
    // array is fully inlined; the splitter must restore en to its entry $ref and
    // mirror each locale under config/{locale}/ — NOT write {locale}/docs.json.
    const mergedDocsJson = {
      navigation: {
        languages: [
          {
            language: 'en',
            tabs: [
              { tab: 'Home', pages: ['docs/index'] },
              {
                tab: 'Guides',
                groups: [{ group: 'Start', pages: ['docs/start'] }],
              },
            ],
          },
          {
            language: 'es',
            tabs: [
              { tab: 'Inicio', pages: ['es/docs/index'] },
              {
                tab: 'Guías',
                groups: [{ group: 'Inicio', pages: ['es/docs/start'] }],
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
      throw new Error('ENOENT');
    });

    // refMap from the read phase: the en entry was a $ref to config/nav.json,
    // and nav.json's "Guides" tab was a nested $ref to navigation/guides.json.
    mockRefMap = new Map([
      [
        '/navigation/languages/0',
        {
          sourceFile: path.resolve('/project/config/nav.json'),
          refPath: 'config/nav.json',
          containingDir: path.resolve('/project'),
          originalContent: {},
        },
      ],
      [
        '/navigation/languages/0/tabs/1',
        {
          sourceFile: path.resolve('/project/config/navigation/guides.json'),
          refPath: './navigation/guides.json',
          containingDir: path.resolve('/project/config'),
          originalContent: {},
        },
      ],
    ]);

    await splitMintlifyLanguageRefs(makeSettings());

    // docs.json: en restored to its entry $ref (no language key — it lives in
    // nav.json); es points to a mirrored nav file under config/es/.
    const docsResult = getWritten('/project/docs.json') as any;
    expect(docsResult.navigation.languages[0]).toEqual({
      $ref: 'config/nav.json',
    });
    expect(docsResult.navigation.languages[1]).toEqual({
      language: 'es',
      $ref: './config/es/nav.json',
    });

    // The English source files must be left untouched (not rewritten).
    expect(getWritten('/project/config/nav.json')).toBeUndefined();
    expect(
      getWritten('/project/config/navigation/guides.json')
    ).toBeUndefined();

    // Locale nav file mirrors nav.json's location and keeps the nested $ref.
    const esNav = getWritten('/project/config/es/nav.json');
    expect(esNav).toEqual({
      tabs: [
        { tab: 'Inicio', pages: ['es/docs/index'] },
        { $ref: './navigation/guides.json' },
      ],
    });

    // The nested ref is mirrored under the locale dir with translated content.
    const esGuides = getWritten('/project/config/es/navigation/guides.json');
    expect(esGuides).toEqual({
      tab: 'Guías',
      groups: [{ group: 'Inicio', pages: ['es/docs/start'] }],
    });
  });

  it('does not clobber a top-level $ref file that was left un-inlined (e.g. redirects)', async () => {
    // mergeJson only re-inlines the composite path (navigation.languages); other
    // refs like `redirects` stay collapsed as { $ref } in the written docs.json.
    // restoreTopLevelRefs must NOT write that placeholder back to the source
    // file — doing so overwrites config/redirects.json with a self-ref and
    // destroys the real redirect array.
    const mergedDocsJson = {
      navigation: {
        languages: [
          { language: 'en', tabs: [{ tab: 'Home', pages: ['docs/index'] }] },
          {
            language: 'es',
            tabs: [{ tab: 'Inicio', pages: ['es/docs/index'] }],
          },
        ],
      },
      redirects: { $ref: './config/redirects.json' },
    };

    mockRead.mockImplementation((p) => {
      const resolved = path.resolve(p as string);
      if (resolved === path.resolve('/project/docs.json'))
        return JSON.stringify(mergedDocsJson);
      throw new Error('ENOENT');
    });

    mockRefMap = new Map([
      [
        '/redirects',
        {
          sourceFile: path.resolve('/project/config/redirects.json'),
          refPath: './config/redirects.json',
          containingDir: path.resolve('/project'),
          originalContent: [],
        },
      ],
    ]);

    await splitMintlifyLanguageRefs(makeSettings());

    // The redirects source file must be left untouched (not written at all).
    expect(getWritten('/project/config/redirects.json')).toBeUndefined();

    // docs.json keeps the redirects $ref intact.
    const docsResult = getWritten('/project/docs.json') as any;
    expect(docsResult.redirects).toEqual({ $ref: './config/redirects.json' });
  });
});
