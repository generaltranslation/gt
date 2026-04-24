import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import { resolveMintlifyRefs } from '../resolveMintlifyRefs';

// Mock fs and logger
vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  },
}));

vi.mock('../../console/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import fs from 'node:fs';
import { logger } from '../../console/logger.js';

const mockExists = vi.mocked(fs.existsSync);
const mockRead = vi.mocked(fs.readFileSync);

function setupFiles(files: Record<string, unknown>) {
  const resolvedFiles: Record<string, string> = {};
  for (const [filePath, content] of Object.entries(files)) {
    resolvedFiles[path.resolve(filePath)] = JSON.stringify(content);
  }

  mockExists.mockImplementation((p) => {
    return path.resolve(p as string) in resolvedFiles;
  });

  mockRead.mockImplementation((p) => {
    const resolved = path.resolve(p as string);
    if (resolved in resolvedFiles) return resolvedFiles[resolved];
    throw new Error(`ENOENT: ${resolved}`);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resolveMintlifyRefs', () => {
  it('returns json unchanged when no $ref present', () => {
    const json = {
      name: 'My Docs',
      navigation: { groups: [{ group: 'Home', pages: ['index'] }] },
    };
    const { resolved, refMap } = resolveMintlifyRefs(
      json,
      '/project/docs.json'
    );
    expect(resolved).toEqual(json);
    expect(refMap.size).toBe(0);
  });

  it('resolves a top-level $ref to an object', () => {
    setupFiles({
      '/project/config/nav.json': {
        groups: [{ group: 'Home', pages: ['index'] }],
      },
    });

    const json = {
      name: 'My Docs',
      navigation: { $ref: './config/nav.json' },
    };

    const { resolved, refMap } = resolveMintlifyRefs(
      json,
      '/project/docs.json'
    );

    expect(resolved).toEqual({
      name: 'My Docs',
      navigation: {
        groups: [{ group: 'Home', pages: ['index'] }],
      },
    });
    expect(refMap.size).toBe(1);
    expect(refMap.has('/navigation')).toBe(true);
    expect(refMap.get('/navigation')!.sourceFile).toBe(
      path.resolve('/project/config/nav.json')
    );
  });

  it('resolves a $ref to an array (non-object)', () => {
    setupFiles({
      '/project/config/groups.json': [
        { group: 'Home', pages: ['index'] },
        { group: 'API', pages: ['api/overview'] },
      ],
    });

    const json = {
      navigation: {
        groups: { $ref: './config/groups.json' },
      },
    };

    const { resolved } = resolveMintlifyRefs(json, '/project/docs.json');

    expect(resolved).toEqual({
      navigation: {
        groups: [
          { group: 'Home', pages: ['index'] },
          { group: 'API', pages: ['api/overview'] },
        ],
      },
    });
  });

  it('merges sibling keys on top when $ref resolves to an object', () => {
    setupFiles({
      '/project/config/appearance.json': {
        default: 'system',
        strict: false,
      },
    });

    const json = {
      appearance: {
        $ref: './config/appearance.json',
        strict: true,
      },
    };

    const { resolved } = resolveMintlifyRefs(json, '/project/docs.json');

    expect(resolved).toEqual({
      appearance: {
        default: 'system',
        strict: true, // sibling overrides ref content
      },
    });
  });

  it('drops sibling keys when $ref resolves to a non-object', () => {
    setupFiles({
      '/project/config/groups.json': [{ group: 'Home', pages: ['index'] }],
    });

    const json = {
      navigation: {
        $ref: './config/groups.json',
        extra: 'ignored',
      },
    };

    const { resolved } = resolveMintlifyRefs(json, '/project/docs.json');

    // Non-object: siblings are dropped
    expect(resolved).toEqual({
      navigation: [{ group: 'Home', pages: ['index'] }],
    });
  });

  it('resolves nested $ref chains', () => {
    setupFiles({
      '/project/config/nav.json': {
        groups: [{ $ref: './groups/api.json' }],
      },
      '/project/config/groups/api.json': {
        group: 'API Reference',
        pages: ['api/users', 'api/posts'],
      },
    });

    const json = {
      navigation: { $ref: './config/nav.json' },
    };

    const { resolved, refMap } = resolveMintlifyRefs(
      json,
      '/project/docs.json'
    );

    expect(resolved).toEqual({
      navigation: {
        groups: [
          {
            group: 'API Reference',
            pages: ['api/users', 'api/posts'],
          },
        ],
      },
    });

    // Both refs tracked
    expect(refMap.size).toBe(2);
    expect(refMap.has('/navigation')).toBe(true);
    expect(refMap.has('/navigation/groups/0')).toBe(true);

    // Nested ref resolves relative to its containing file
    expect(refMap.get('/navigation/groups/0')!.sourceFile).toBe(
      path.resolve('/project/config/groups/api.json')
    );
  });

  it('detects circular references and warns', () => {
    setupFiles({
      '/project/config/a.json': { $ref: './b.json' },
      '/project/config/b.json': { $ref: './a.json' },
    });

    const json = { data: { $ref: './config/a.json' } };

    const { resolved } = resolveMintlifyRefs(json, '/project/docs.json');

    // Should not throw — gracefully returns what it can
    expect(resolved).toBeDefined();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Circular')
    );
  });

  it('warns and skips non-relative paths', () => {
    const json = {
      navigation: { $ref: '/absolute/path.json' },
    };

    const { resolved } = resolveMintlifyRefs(json, '/project/docs.json');

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('non-relative')
    );
    // $ref removed, siblings preserved (empty object in this case)
    expect(resolved).toEqual({ navigation: {} });
  });

  it('warns and skips URL refs', () => {
    const json = {
      navigation: { $ref: 'https://example.com/nav.json' },
    };

    const { resolved } = resolveMintlifyRefs(json, '/project/docs.json');

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('non-relative')
    );
  });

  it('warns when referenced file does not exist', () => {
    mockExists.mockReturnValue(false);

    const json = {
      navigation: { $ref: './missing.json' },
    };

    const { resolved } = resolveMintlifyRefs(json, '/project/docs.json');

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('not found')
    );
    expect(resolved).toEqual({ navigation: {} });
  });

  it('warns when referenced file is not valid JSON', () => {
    mockExists.mockReturnValue(true);
    mockRead.mockReturnValue('not json {{{');

    const json = {
      navigation: { $ref: './bad.json' },
    };

    const { resolved } = resolveMintlifyRefs(json, '/project/docs.json');

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('not valid JSON')
    );
  });

  it('handles $ref inside arrays', () => {
    setupFiles({
      '/project/groups/home.json': {
        group: 'Home',
        pages: ['index', 'quickstart'],
      },
      '/project/groups/api.json': {
        group: 'API',
        pages: ['api/overview'],
      },
    });

    const json = {
      navigation: {
        groups: [{ $ref: './groups/home.json' }, { $ref: './groups/api.json' }],
      },
    };

    const { resolved, refMap } = resolveMintlifyRefs(
      json,
      '/project/docs.json'
    );

    expect(resolved).toEqual({
      navigation: {
        groups: [
          { group: 'Home', pages: ['index', 'quickstart'] },
          { group: 'API', pages: ['api/overview'] },
        ],
      },
    });
    expect(refMap.size).toBe(2);
  });

  it('preserves non-$ref objects untouched', () => {
    const json = {
      colors: { primary: '#ff0000', light: '#ffffff' },
      name: 'Docs',
      navigation: { groups: [] },
    };

    const { resolved } = resolveMintlifyRefs(json, '/project/docs.json');
    expect(resolved).toEqual(json);
  });

  it('handles deeply nested structures', () => {
    setupFiles({
      '/project/config/nav.json': {
        tabs: [
          {
            tab: 'Guides',
            groups: [
              {
                group: 'Getting Started',
                pages: ['intro'],
              },
            ],
          },
        ],
      },
    });

    const json = {
      theme: 'mint',
      navigation: {
        $ref: './config/nav.json',
        languages: [{ language: 'en' }],
      },
    };

    const { resolved } = resolveMintlifyRefs(json, '/project/docs.json');

    // $ref resolves to an object, so siblings merge on top
    expect(resolved).toEqual({
      theme: 'mint',
      navigation: {
        tabs: [
          {
            tab: 'Guides',
            groups: [
              {
                group: 'Getting Started',
                pages: ['intro'],
              },
            ],
          },
        ],
        languages: [{ language: 'en' }],
      },
    });
  });

  it('records original (pre-resolution) content in refMap', () => {
    const navContent = {
      groups: [{ $ref: './groups/api.json' }],
    };
    const apiContent = {
      group: 'API',
      pages: ['api/users'],
    };

    setupFiles({
      '/project/config/nav.json': navContent,
      '/project/config/groups/api.json': apiContent,
    });

    const json = { navigation: { $ref: './config/nav.json' } };
    const { refMap } = resolveMintlifyRefs(json, '/project/docs.json');

    // originalContent is the raw parsed content before nested resolution
    const navEntry = refMap.get('/navigation');
    expect(navEntry).toBeDefined();
    expect(navEntry!.originalContent).toEqual(navContent);
  });

  it('records refPath and containingDir in refMap entries', () => {
    setupFiles({
      '/project/config/nav.json': {
        groups: [{ $ref: './groups/api.json' }],
      },
      '/project/config/groups/api.json': {
        group: 'API',
        pages: ['api/users'],
      },
    });

    const json = { navigation: { $ref: './config/nav.json' } };
    const { refMap } = resolveMintlifyRefs(json, '/project/docs.json');

    const navEntry = refMap.get('/navigation');
    expect(navEntry!.refPath).toBe('./config/nav.json');
    expect(navEntry!.containingDir).toBe(path.resolve('/project'));

    const apiEntry = refMap.get('/navigation/groups/0');
    expect(apiEntry!.refPath).toBe('./groups/api.json');
    expect(apiEntry!.containingDir).toBe(path.resolve('/project/config'));
  });

  it('handles $ref resolving to a non-object (string)', () => {
    setupFiles({
      '/project/config/description.json': 'A simple string value',
    });

    // $ref resolves to a string — Mintlify drops sibling keys
    const json = {
      description: { $ref: './config/description.json', extra: 'dropped' },
    };
    const { resolved } = resolveMintlifyRefs(json, '/project/docs.json');

    // Non-object: sibling keys are dropped, value replaces the object
    expect((resolved as any).description).toBe('A simple string value');
  });

  it('handles multiple $ref at the same level', () => {
    setupFiles({
      '/project/config/nav.json': { groups: [] },
      '/project/config/navbar.json': {
        links: [{ label: 'Support' }],
      },
      '/project/config/footer.json': {
        socials: { github: 'https://github.com/acme' },
      },
    });

    const json = {
      navigation: { $ref: './config/nav.json' },
      navbar: { $ref: './config/navbar.json' },
      footer: { $ref: './config/footer.json' },
    };

    const { resolved, refMap } = resolveMintlifyRefs(
      json,
      '/project/docs.json'
    );

    expect(resolved).toEqual({
      navigation: { groups: [] },
      navbar: { links: [{ label: 'Support' }] },
      footer: { socials: { github: 'https://github.com/acme' } },
    });
    expect(refMap.size).toBe(3);
  });

  it('handles shouldResolveRefs correctly', async () => {
    const { shouldResolveRefs } = await import('../resolveMintlifyRefs');

    expect(shouldResolveRefs('/project/docs.json', undefined)).toBe(false);
    expect(shouldResolveRefs('/project/docs.json', {})).toBe(false);
    expect(
      shouldResolveRefs('/project/docs.json', {
        mintlify: { inferTitleFromFilename: true },
      })
    ).toBe(false);
    expect(
      shouldResolveRefs('/project/docs.json', {
        mintlify: { inferTitleFromFilename: true },
        jsonSchema: { './other.json': { composite: {} } },
      })
    ).toBe(false);
  });
});
