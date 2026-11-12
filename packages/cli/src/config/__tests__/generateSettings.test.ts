import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateSettings } from '../generateSettings';
import { resolveFiles } from '../../fs/config/parseFilesConfig';
import { logger } from '../../console/logger.js';
import { resolveConfig } from '../resolveConfig.js';
import { createUserTokenProvider } from '../../auth/oauth.js';
import { logErrorAndExit } from '../../console/logging.js';

// Mock resolveFiles
vi.mock('../../fs/config/parseFilesConfig', () => ({
  resolveFiles: vi.fn(),
}));

// Mock other dependencies
vi.mock('../../console/logging.js', () => ({
  logErrorAndExit: vi.fn(),
  displayProjectId: vi.fn(),
}));
vi.mock('../../console/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../fs/config/findGTConfig.js', () => ({
  findGTConfig: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../fs/config/parseGTConfig.js', () => ({
  parseGTConfig: vi.fn().mockResolvedValue({
    defaultLocale: 'en',
    locales: ['fr', 'es'],
  }),
}));

vi.mock('../validateSettings.js', () => ({
  validateSettings: vi.fn(),
}));

vi.mock('../resolveConfig.js', () => ({
  resolveConfig: vi.fn().mockReturnValue({
    config: {
      defaultLocale: 'en',
      locales: ['fr', 'es'],
    },
    path: '/test/gt.config.json',
  }),
}));

vi.mock('../../fs/utils.js', () => ({
  resolveProjectId: vi.fn().mockReturnValue('test-project-id'),
}));

vi.mock('../../utils/api.js', () => ({
  configureCustomMapping: vi.fn(),
}));

vi.mock('../../auth/oauth.js', () => ({
  createUserTokenProvider: vi.fn(() => ({
    getAccessToken: vi.fn(),
    refreshAccessToken: vi.fn(),
  })),
}));

vi.mock('../optionPresets.js', () => ({
  generatePreset: vi.fn(),
}));

const mockLogWarning = vi.mocked(logger.warn);
const mockResolveConfig = vi.mocked(resolveConfig);

describe('generateSettings - composite patterns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveConfig.mockReturnValue({
      config: {
        defaultLocale: 'en',
        locales: ['fr', 'es'],
      },
      path: '/test/gt.config.json',
    });
    vi.mocked(resolveFiles).mockReturnValue({
      resolvedPaths: {},
      placeholderPaths: {},
      transformPaths: {},
      transformFormats: {},
      publishPaths: new Set(),
      unpublishPaths: new Set(),
      parsingFlags: {},
      gtJson: { parsingFlags: {} as unknown },
    });
  });

  it.each([
    [
      'the jsonSchema patterns marked composite',
      {
        jsonSchema: {
          'composite-pattern-1': { composite: true },
          'regular-pattern': { composite: false },
          'composite-pattern-2': { composite: true },
          'another-pattern': {},
        },
        // Only jsonSchema declares composite patterns.
        yamlSchema: {
          'yaml-composite': { composite: true },
          'yaml-regular': {},
        },
      },
      ['composite-pattern-1', 'composite-pattern-2'],
    ],
    [
      'nothing when no jsonSchema pattern is composite',
      { jsonSchema: { 'regular-pattern': { composite: false }, other: {} } },
      [],
    ],
    ['nothing without jsonSchema options', {}, []],
    ['nothing without options', undefined, []],
  ])(
    'passes %s to resolveFiles as composite patterns',
    async (_case, options, compositePatterns) => {
      const files = { json: { include: ['src/*.json'] } };

      await generateSettings({ files, options }, '/test/cwd');

      expect(resolveFiles).toHaveBeenCalledWith(
        files,
        'en',
        ['fr', 'es'],
        '/test/cwd',
        compositePatterns,
        false
      );
    }
  );

  it.each([
    ['package.json', JSON.stringify({ dependencies: { next: '15.5.9' } })],
    ['pyproject.toml', '[project]\nname = "example"\n'],
    ['requirements.txt', 'flask\n'],
    ['setup.py', 'from setuptools import setup\nsetup(name="example")\n'],
  ])(
    'does not warn when %s exists without a GT library',
    async (file, content) => {
      const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-settings-'));
      try {
        fs.writeFileSync(path.join(cwd, file), content);

        await generateSettings({}, cwd);

        expect(mockLogWarning).not.toHaveBeenCalledWith(
          expect.stringContaining(
            'No package.json or Python project file found'
          )
        );
      } finally {
        fs.rmSync(cwd, { recursive: true, force: true });
      }
    }
  );

  it('warns when no project manifest or file translation config is found', async () => {
    await generateSettings({}, '/test/cwd');

    expect(mockLogWarning).toHaveBeenCalledWith(
      expect.stringContaining('No package.json or Python project file found')
    );
  });

  it('does not count files.gt as file translation config', async () => {
    await generateSettings(
      {
        files: {
          gt: { output: 'translations/[locale].json' },
        },
      },
      '/test/cwd'
    );

    expect(mockLogWarning).toHaveBeenCalledWith(
      expect.stringContaining('No package.json or Python project file found')
    );
  });

  it('suppresses the warning when file translation config is present', async () => {
    await generateSettings(
      {
        files: {
          gt: { output: 'translations/[locale].json' },
          pot: { include: ['locales/*.pot'] },
        },
      },
      '/test/cwd'
    );

    expect(mockLogWarning).not.toHaveBeenCalledWith(
      expect.stringContaining('No package.json')
    );
  });

  it('reads omitConfigIds from config', async () => {
    mockResolveConfig.mockReturnValue({
      config: {
        defaultLocale: 'en',
        locales: ['fr', 'es'],
        omitConfigIds: true,
      },
      path: '/test/gt.config.json',
    });

    const settings = await generateSettings({}, '/test/cwd');

    expect(settings.omitConfigIds).toBe(true);
  });

  it('reads omitConfigIds from flags', async () => {
    const settings = await generateSettings(
      { omitConfigIds: true },
      '/test/cwd'
    );

    expect(settings.omitConfigIds).toBe(true);
  });

  it('warns when config ids are omitted while publish is enabled', async () => {
    await generateSettings({ omitConfigIds: true, publish: true }, '/test/cwd');

    expect(mockLogWarning).toHaveBeenCalledWith(
      expect.stringContaining('Config IDs will be omitted')
    );
  });

  it('warns once about unknown top-level config keys', async () => {
    mockResolveConfig.mockReturnValueOnce({
      config: { locales: ['fr'], custom: true, locale: 'de' },
      path: '/test/gt.config.json',
    });

    await generateSettings({}, '/test/cwd');

    const warnings = mockLogWarning.mock.calls
      .map(([message]) => message)
      .filter((message) => message.includes('does not read'));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain(
      'gt Warning: /test/gt.config.json has keys the CLI does not read'
    );
    expect(warnings[0]).toContain('custom, locale');
  });

  it('reads tag and tagMessage from the config without warning', async () => {
    mockResolveConfig.mockReturnValueOnce({
      config: { locales: ['fr'], tag: 'release', tagMessage: 'Launch' },
      path: '/test/gt.config.json',
    });

    const settings = await generateSettings({}, '/test/cwd');

    expect(
      mockLogWarning.mock.calls.filter(([message]) =>
        message.includes('does not read')
      )
    ).toEqual([]);
    expect(settings).toMatchObject({ tag: 'release', tagMessage: 'Launch' });
  });

  it('rejects a docsUrlPattern list entry without [locale]', async () => {
    await generateSettings(
      { options: { docsUrlPattern: ['/docs/[locale]', '/ai/docs'] } },
      '/test/cwd'
    );

    expect(vi.mocked(logErrorAndExit)).toHaveBeenCalledWith(
      expect.stringContaining('missing "[locale]"')
    );
  });

  it('accepts a docsUrlPattern list', async () => {
    await generateSettings(
      { options: { docsUrlPattern: ['/docs/[locale]', '/ai/docs/[locale]'] } },
      '/test/cwd'
    );

    expect(vi.mocked(logErrorAndExit)).not.toHaveBeenCalled();
  });

  describe('options.saveLocal', () => {
    it('defaults to false when neither flag nor config sets it', async () => {
      const settings = await generateSettings({}, '/test/cwd');
      expect(settings.options?.saveLocal).toBe(false);
    });

    it('reads options.saveLocal from gt.config.json', async () => {
      mockResolveConfig.mockReturnValueOnce({
        config: {
          defaultLocale: 'en',
          locales: ['fr', 'es'],
          options: { saveLocal: false },
        },
        path: '/test/gt.config.json',
      });
      const settings = await generateSettings({}, '/test/cwd');
      expect(settings.options?.saveLocal).toBe(false);
    });

    it('lets --no-save-local override a config value of true', async () => {
      mockResolveConfig.mockReturnValueOnce({
        config: {
          defaultLocale: 'en',
          locales: ['fr', 'es'],
          options: { saveLocal: true },
        },
        path: '/test/gt.config.json',
      });
      const settings = await generateSettings(
        { saveLocal: false },
        '/test/cwd'
      );
      expect(settings.options?.saveLocal).toBe(false);
    });

    it('lets --save-local override a config value of false', async () => {
      mockResolveConfig.mockReturnValueOnce({
        config: {
          defaultLocale: 'en',
          locales: ['fr', 'es'],
          options: { saveLocal: false },
        },
        path: '/test/gt.config.json',
      });
      const settings = await generateSettings({ saveLocal: true }, '/test/cwd');
      expect(settings.options?.saveLocal).toBe(true);
    });
  });

  it('keeps the API key, or else a lazy user token provider', async () => {
    const userSettings = await generateSettings({}, '/test/cwd');
    const keySettings = await generateSettings(
      { apiKey: 'explicit-api-key' },
      '/test/cwd'
    );

    expect(userSettings.apiKey).toBeUndefined();
    expect(userSettings.userTokenProvider).toBe(
      vi.mocked(createUserTokenProvider).mock.results[0].value
    );
    expect(
      userSettings.userTokenProvider!.getAccessToken
    ).not.toHaveBeenCalled();
    expect(keySettings.apiKey).toBe('explicit-api-key');
  });

  it('sends requests to GT_API_URL over the configured base URL', async () => {
    mockResolveConfig.mockReturnValue({
      config: { baseUrl: 'https://configured.example' },
      path: '/test/gt.config.json',
    });
    expect((await generateSettings({}, '/test/cwd')).baseUrl).toBe(
      'https://configured.example'
    );

    vi.stubEnv('GT_API_URL', 'https://staging.example');
    try {
      const settings = await generateSettings({}, '/test/cwd');
      expect(settings.baseUrl).toBe('https://staging.example');
      expect(vi.mocked(createUserTokenProvider)).toHaveBeenLastCalledWith({
        baseUrl: 'https://staging.example',
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('should not call resolveFiles when files are not provided', async () => {
    const options = {
      options: {
        jsonSchema: {
          'composite-pattern': { composite: true },
        },
      },
    };

    await generateSettings(options, '/test/cwd');

    expect(resolveFiles).not.toHaveBeenCalled();
  });

  it('normalizes uppercase file format config keys before resolving files', async () => {
    const options = {
      files: {
        POT: {
          include: ['locales/[locale]/*.pot'],
          transformationFormat: 'PO',
        },
      },
    };

    await generateSettings(options, '/test/cwd');

    expect(resolveFiles).toHaveBeenCalledWith(
      {
        pot: {
          include: ['locales/[locale]/*.pot'],
          transformationFormat: 'PO',
        },
      },
      'en',
      ['fr', 'es'],
      '/test/cwd',
      [],
      false
    );
  });
});

describe('generateSettings - openapi config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveFiles).mockReturnValue({
      resolvedPaths: {},
      placeholderPaths: {},
      transformPaths: {},
      transformFormats: {},
      publishPaths: new Set(),
      unpublishPaths: new Set(),
      parsingFlags: {},
      gtJson: { parsingFlags: {} as unknown },
    });
  });

  it('does not auto-add jsonSchema entries for openapi files', async () => {
    const settings = await generateSettings({
      options: {
        openapi: {
          framework: 'mintlify',
          files: ['./openapi.json', './discovery-openapi.json'],
        },
      },
    });

    expect(settings.options?.jsonSchema).toBeUndefined();
  });
});
