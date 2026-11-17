import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FileToUpload } from 'generaltranslation';
import { hashSource } from 'generaltranslation/id';
import { createMockSettings } from '../../../api/__mocks__/settings.js';
import { logger } from '../../../console/logger.js';
import { collectFiles } from '../../../formats/files/collectFiles.js';
import updateConfig from '../../../fs/config/updateConfig.js';
import { uploadMigration } from '../../../migrate/upload.js';
import type { Settings } from '../../../types/index.js';
import { requireProject } from '../../../utils/api.js';
import {
  TEMPLATE_FILE_ID,
  TEMPLATE_FILE_NAME,
} from '../../../utils/constants.js';
import { handleMigrate, type MigrateFlags } from '../migrate.js';

vi.mock('../../../formats/files/collectFiles.js', () => ({
  collectFiles: vi.fn(),
}));
vi.mock('../../../fs/config/updateConfig.js', () => ({ default: vi.fn() }));
vi.mock('../../../migrate/upload.js', () => ({ uploadMigration: vi.fn() }));
vi.mock('../../../utils/api.js', () => ({
  requireProject: vi.fn(() => ({ name: 'client' })),
  resolveCanonicalLocale: (locale: string) => locale,
}));
vi.mock('../../../workflows/steps/BranchStep.js', () => ({
  BranchStep: vi.fn(() => ({ run: async () => branchData })),
}));
vi.mock('../../../console/displayTranslateSummary.js', () => ({
  displayTranslateSummary: vi.fn(),
}));
vi.mock('../../../console/logger.js', () => ({
  logger: {
    error: vi.fn(),
    message: vi.fn(),
    step: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
  },
}));
vi.mock('../../../console/logging.js', () => ({
  exitSync: vi.fn((code: number) => {
    throw new Error(`exit ${code}`);
  }),
  logErrorAndExit: vi.fn((message: string) => {
    throw new Error(message);
  }),
}));

const branchData = {
  currentBranch: { id: 'branch-1', name: 'main' },
  incomingBranch: null,
  checkedOutBranch: null,
};

const legacyIcuHash = (source: string) =>
  hashSource({ source, dataFormat: 'ICU' });

const WELCOME = 'aaaaaaaaaaaaaaaa';
const GREETING = 'bbbbbbbbbbbbbbbb';
const CART = 'cccccccccccccccc';
const OLD_WELCOME = legacyIcuHash('Welcome');
const OLD_GREETING = legacyIcuHash('Hi {user}');

const template = {
  fileName: TEMPLATE_FILE_NAME,
  content: JSON.stringify({
    [WELCOME]: 'Welcome',
    [GREETING]: ['Hi ', ['name']],
    [CART]: ['Cart'],
  }),
  fileFormat: 'GTJSON',
  formatMetadata: {
    [WELCOME]: { hash: WELCOME, dataFormat: 'MESSAGE_TREE' },
    [GREETING]: { hash: GREETING, dataFormat: 'MESSAGE_TREE' },
    [CART]: { hash: CART, dataFormat: 'JSX' },
  },
  fileId: TEMPLATE_FILE_ID,
  versionId: 'version-1',
  locale: 'en',
} satisfies FileToUpload;

const legacyFiles: Record<string, Record<string, unknown>> = {
  en: {
    [OLD_WELCOME]: 'Welcome',
    [OLD_GREETING]: 'Hi {user}',
    [CART]: ['Cart'],
  },
  fr: {
    [OLD_WELCOME]: 'Bienvenue',
    [OLD_GREETING]: 'Salut {user}',
    [CART]: ['Panier'],
  },
  de: { [OLD_WELCOME]: 'Willkommen', [CART]: ['Warenkorb'] },
};

const migrated = {
  fr: `{
  "${WELCOME}": "Bienvenue",
  "${GREETING}": [
    "Salut ",
    [
      "name"
    ]
  ],
  "${CART}": [
    "Panier"
  ]
}`,
  de: `{
  "${WELCOME}": "Willkommen",
  "${CART}": [
    "Warenkorb"
  ]
}`,
};

let dir: string;
const outputPath = (locale: string) =>
  path.join(dir, 'public', '_gt', `${locale}.json`);
const backupPath = (locale: string) =>
  path.join(dir, '.gt', 'migrate-backup', `${locale}.json`);
const read = (file: string) => fs.readFileSync(file, 'utf8');

function writeJson(file: string, json: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
}

function writeLegacyFiles(at: (locale: string) => string = outputPath) {
  for (const [locale, json] of Object.entries(legacyFiles)) {
    writeJson(at(locale), json);
  }
}

function settings(overrides: Partial<Settings> = {}): Settings {
  return createMockSettings({
    config: path.join(dir, 'gt.config.json'),
    projectId: 'project-1',
    defaultLocale: 'en',
    locales: ['en', 'fr', 'de', 'ja'],
    files: {
      resolvedPaths: {},
      placeholderPaths: { gt: path.join(dir, 'public/_gt/[locale].json') },
      transformPaths: {},
    },
    branchOptions: {
      enabled: true,
      autoDetectBranches: false,
      remoteName: 'origin',
    },
    ...overrides,
  });
}

const migrate = (
  options: Partial<MigrateFlags> = {},
  overrides: Partial<Settings> = {}
) => handleMigrate(options as MigrateFlags, settings(overrides), 'gt-react');

const warnings = () =>
  vi.mocked(logger.warn).mock.calls.map(([message]) => message);

describe('handleMigrate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dir = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'gt-migrate-'))
    );
    vi.spyOn(process, 'cwd').mockReturnValue(dir);
    vi.mocked(collectFiles).mockResolvedValue({
      files: [template],
      reactComponents: 3,
      publishMap: new Map(),
    });
    vi.mocked(uploadMigration).mockResolvedValue({
      completedLocales: ['fr'],
      seededLocales: ['de'],
      sourceUploaded: true,
      failed: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('writes nothing on a dry run but the report', async () => {
    writeLegacyFiles();
    const report = path.join(dir, 'reports', 'migrate.json');

    await migrate({ dryRun: true, report });

    expect(read(outputPath('fr'))).toBe(
      JSON.stringify(legacyFiles.fr, null, 2) + '\n'
    );
    expect(fs.existsSync(path.join(dir, '.gt'))).toBe(false);
    expect(fs.existsSync(outputPath('ja'))).toBe(false);
    expect(uploadMigration).not.toHaveBeenCalled();
    expect(warnings()).toEqual([]);
    expect(logger.success).toHaveBeenCalledWith(
      'Dry run: no files were written or uploaded.'
    );
    const written = JSON.parse(read(report));
    expect(read(report).endsWith('}\n')).toBe(true);
    expect(
      written.messages.map(
        (message: { newHash: string; tier?: string; oldKey?: string }) => [
          message.newHash,
          message.tier,
          message.oldKey,
        ]
      )
    ).toEqual([
      [WELCOME, 'predicted-hash', OLD_WELCOME],
      [GREETING, 'source-alpha', OLD_GREETING],
      [CART, 'same-key', CART],
    ]);
  });

  it.each([
    { name: 'with --no-upload', options: { upload: false }, overrides: {} },
    { name: 'without a project id', options: {}, overrides: { projectId: '' } },
  ])(
    'writes sorted files and backups $name without uploading',
    async ({ options, overrides }) => {
      writeLegacyFiles();

      await migrate(options, overrides);

      expect(read(outputPath('fr'))).toBe(migrated.fr);
      expect(read(outputPath('de'))).toBe(migrated.de);
      expect(fs.existsSync(outputPath('ja'))).toBe(false);
      for (const locale of ['fr', 'de']) {
        expect(read(backupPath(locale))).toBe(
          JSON.stringify(legacyFiles[locale], null, 2) + '\n'
        );
      }
      expect(fs.existsSync(backupPath('en'))).toBe(false);
      expect(warnings()).toEqual([
        expect.stringContaining('The migrated translations were not uploaded'),
      ]);
      expect(uploadMigration).not.toHaveBeenCalled();
      expect(updateConfig).not.toHaveBeenCalled();
    }
  );

  it.each([
    {
      name: 'records the version and branch',
      overrides: {},
      configs: [{ _versionId: 'version-1', _branchId: 'branch-1' }],
    },
    {
      name: 'clears the ids with omitConfigIds',
      overrides: { omitConfigIds: true },
      configs: [{ _versionId: null, _branchId: null }],
    },
    {
      name: 'clears the branch when branching is disabled',
      overrides: {
        branchOptions: {
          enabled: false,
          autoDetectBranches: false,
          remoteName: 'origin',
        },
      },
      configs: [
        { _versionId: 'version-1', _branchId: 'branch-1' },
        { _branchId: null },
      ],
    },
  ])('uploads and $name', async ({ overrides, configs }) => {
    writeLegacyFiles();

    await migrate({}, overrides);

    const used = settings(overrides);
    expect(requireProject).toHaveBeenCalledWith(used);
    expect(uploadMigration).toHaveBeenCalledWith({
      client: { name: 'client' },
      settings: used,
      branchData,
      template,
      translations: migrated,
      completeLocales: ['fr'],
    });
    expect(vi.mocked(updateConfig).mock.calls).toEqual(
      configs.map((config) => [path.join(dir, 'gt.config.json'), config])
    );
    expect(warnings()).toEqual([]);
  });

  it('records no ids when the source was not uploaded', async () => {
    writeLegacyFiles();
    vi.mocked(uploadMigration).mockResolvedValue({
      completedLocales: [],
      seededLocales: [],
      sourceUploaded: false,
      failed: true,
    });

    await migrate();

    expect(updateConfig).not.toHaveBeenCalled();
  });

  it('produces the same files when run again, from the untouched backups', async () => {
    writeLegacyFiles();
    await migrate({ upload: false });
    const backups = ['fr', 'de'].map((locale) => read(backupPath(locale)));

    await migrate({ upload: false });

    expect(read(outputPath('fr'))).toBe(migrated.fr);
    expect(read(outputPath('de'))).toBe(migrated.de);
    expect(['fr', 'de'].map((locale) => read(backupPath(locale)))).toEqual(
      backups
    );
  });

  it('reads the legacy files from --from', async () => {
    writeLegacyFiles((locale) => path.join(dir, 'legacy', `${locale}.json`));

    await migrate({ upload: false, from: 'legacy' });

    expect(read(outputPath('fr'))).toBe(migrated.fr);
    expect(read(outputPath('de'))).toBe(migrated.de);
    expect(fs.existsSync(path.join(dir, '.gt'))).toBe(false);
  });

  it.each([
    {
      name: 'a 64-character key',
      locale: 'fr',
      json: { ['ab'.repeat(32)]: 'Bonjour' },
      reason: `it has the 64-character key ${'ab'.repeat(32)}`,
    },
    {
      name: 'JSX in the {type, props} form',
      locale: 'de',
      json: { [CART]: { type: 'b', props: { children: 'Warenkorb' } } },
      reason: `the value of ${CART} is JSX in the {type, props} form`,
    },
    {
      name: 'a 64-character key in the legacy source',
      locale: 'en',
      json: { ['ab'.repeat(32)]: 'Hello' },
      reason: 'it uses 64-character keys',
    },
  ])('exits when a catalog has $name', async ({ locale, json, reason }) => {
    writeLegacyFiles();
    writeJson(outputPath(locale), json);

    const error = await migrate({ upload: false }).catch(
      (thrown: Error) => thrown.message
    );

    expect(error).toContain(`public/_gt/${locale}.json cannot be migrated`);
    expect(error).toContain(reason);
    expect(fs.existsSync(path.join(dir, '.gt'))).toBe(false);
  });

  it('warns about id keys in a locale file', async () => {
    writeLegacyFiles();
    writeJson(outputPath('fr'), { ...legacyFiles.fr, 'nav.home': 'Accueil' });

    await migrate({ dryRun: true });

    expect(warnings()).toEqual([
      expect.stringContaining(
        'public/_gt/fr.json has 1 entries keyed by id instead of hash'
      ),
    ]);
  });

  it('still migrates by key and predicted hash without the legacy source', async () => {
    writeLegacyFiles();
    fs.rmSync(outputPath('en'));

    await migrate({ upload: false });

    expect(warnings()).toEqual([
      expect.stringContaining('The migrated translations were not uploaded'),
      expect.stringContaining(
        'No legacy source file was found at public/_gt/en.json'
      ),
    ]);
    expect(JSON.parse(read(outputPath('fr')))).toEqual({
      [WELCOME]: 'Bienvenue',
      [CART]: ['Panier'],
    });
  });

  it('exits when the source scan finds no messages', async () => {
    vi.mocked(collectFiles).mockResolvedValue({
      files: [],
      reactComponents: 0,
      publishMap: new Map(),
    });

    await expect(migrate({ upload: false })).rejects.toThrow(
      'No messages were found to migrate translations to'
    );
  });
});
