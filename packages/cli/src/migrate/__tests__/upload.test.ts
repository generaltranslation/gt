import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FileToUpload } from 'generaltranslation';
import { createMockSettings } from '../../api/__mocks__/settings.js';
import { logger } from '../../console/logger.js';
import { clearWarnings, getWarnings } from '../../state/translateWarnings.js';
import type { BranchData } from '../../types/branch.js';
import { TEMPLATE_FILE_ID, TEMPLATE_FILE_NAME } from '../../utils/constants.js';
import { UploadTranslationsStep } from '../../workflows/steps/UploadTranslationsStep.js';
import {
  type MigrationUploadClient,
  seedVersionId,
  uploadMigration,
} from '../upload.js';

vi.mock('../../console/logger.js', () => ({
  logger: { warn: vi.fn() },
}));
const { stepRun } = vi.hoisted(() => ({ stepRun: vi.fn() }));
vi.mock('../../workflows/steps/UploadTranslationsStep.js', () => ({
  UploadTranslationsStep: vi.fn(() => ({ run: stepRun })),
}));

const VERSION = 'version-1';
const SEED = seedVersionId(VERSION);
const settings = createMockSettings({
  defaultLocale: 'en',
  locales: ['en', 'fr', 'de'],
});
const branchData: BranchData = {
  currentBranch: { id: 'branch-1', name: 'main' },
  incomingBranch: { id: 'branch-in', name: 'feature' },
  checkedOutBranch: { id: 'branch-out', name: 'release' },
};
const template = {
  fileName: TEMPLATE_FILE_NAME,
  content: '{"aaaaaaaaaaaaaaaa":"Hello"}',
  fileFormat: 'GTJSON',
  formatMetadata: { aaaaaaaaaaaaaaaa: { dataFormat: 'MESSAGE_TREE' } },
  fileId: TEMPLATE_FILE_ID,
  versionId: VERSION,
  locale: 'en',
} satisfies FileToUpload;
const source = { ...template, branchId: 'branch-1' };
const translations = { fr: '{"fr":1}', de: '{"de":1}' };

const sourceUpload = (versionId: string) => [
  [
    {
      source: {
        ...source,
        versionId,
        locale: 'en',
        incomingBranchId: 'branch-in',
        checkedOutBranchId: 'branch-out',
      },
    },
  ],
  { sourceLocale: 'en' },
];
const translationFile = (locale: 'fr' | 'de', versionId: string) => ({
  content: translations[locale],
  fileName: TEMPLATE_FILE_NAME,
  fileFormat: 'GTJSON',
  fileId: TEMPLATE_FILE_ID,
  versionId,
  locale,
});

type SourceResult =
  | { status: 'succeeded' }
  | { status: 'failed'; error: string };

function fakeClient({
  exists = false,
  sourceResults = [],
  failedLocales = [],
}: {
  exists?: boolean;
  sourceResults?: SourceResult[];
  failedLocales?: string[];
} = {}) {
  const calls: string[] = [];
  const queryFiles = vi.fn(async () => ({
    results: [{ status: exists ? 'found' : 'not_found' }],
  }));
  const uploadSourceFiles = vi.fn(
    async (files: { source: FileToUpload }[], _options: unknown) => {
      calls.push(`source ${files[0].source.versionId}`);
      const result = sourceResults.shift() ?? { status: 'succeeded' };
      return {
        results: [{ ...result, fileName: TEMPLATE_FILE_NAME }],
      };
    }
  );
  const uploadTranslations = vi.fn(
    async (files: { source: FileToUpload; translations: FileToUpload[] }[]) => {
      calls.push(
        `translations ${files[0].source.versionId} ${files[0].translations.map((t) => t.locale).join(',')}`
      );
      return {
        results: files[0].translations.map(({ locale }) =>
          failedLocales.includes(locale)
            ? {
                status: 'failed',
                locale,
                fileName: TEMPLATE_FILE_NAME,
                error: 'rejected',
              }
            : { status: 'succeeded', locale, fileName: TEMPLATE_FILE_NAME }
        ),
      };
    }
  );
  stepRun.mockImplementation(
    async ({
      files,
    }: {
      files: { source: FileToUpload; translations: FileToUpload[] }[];
    }) => {
      calls.push(
        `step ${files[0].source.versionId} ${files[0].translations.map((t) => t.locale).join(',')}`
      );
      return files[0].translations.map(({ fileId, versionId, locale }) => ({
        fileId,
        versionId,
        branchId: 'branch-1',
        locale,
      }));
    }
  );
  const client = {
    queryFiles,
    uploadSourceFiles,
    uploadTranslations,
  } as unknown as MigrationUploadClient;
  return { client, calls, queryFiles, uploadSourceFiles, uploadTranslations };
}

const run = (
  client: MigrationUploadClient,
  completeLocales: string[],
  files: Record<string, string> = translations
) =>
  uploadMigration({
    client,
    settings,
    branchData,
    template,
    translations: files,
    completeLocales,
  });

const stepLocales = () =>
  stepRun.mock.calls.flatMap(([{ files }]) =>
    files.flatMap((file: { translations: FileToUpload[] }) =>
      file.translations.map((t) => t.locale)
    )
  );

describe('seedVersionId', () => {
  it('derives a stable version id distinct from the real one', () => {
    expect(SEED).toBe(seedVersionId(VERSION));
    expect(SEED).not.toBe(VERSION);
    expect(SEED).not.toBe(seedVersionId('version-2'));
    expect(SEED).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('uploadMigration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearWarnings();
  });

  it.each([
    { name: 'every locale', complete: ['fr', 'de'] },
    { name: 'locales with a file', complete: ['fr', 'de', 'ja'] },
  ])(
    'uploads the real version only when $name is complete',
    async ({ complete }) => {
      const { client, calls, queryFiles, uploadSourceFiles } = fakeClient();

      const result = await run(client, complete);

      expect(queryFiles).toHaveBeenCalledWith([
        { fileId: TEMPLATE_FILE_ID, versionId: VERSION, branchId: 'branch-1' },
      ]);
      expect(calls).toEqual([`source ${VERSION}`, `step ${VERSION} fr,de`]);
      expect(uploadSourceFiles).toHaveBeenCalledWith(...sourceUpload(VERSION));
      expect(UploadTranslationsStep).toHaveBeenCalledWith(client, settings);
      expect(stepRun).toHaveBeenCalledWith({
        files: [
          {
            source,
            translations: [
              translationFile('fr', VERSION),
              translationFile('de', VERSION),
            ],
          },
        ],
      });
      expect(result).toEqual({
        completedLocales: ['fr', 'de'],
        seededLocales: [],
        sourceUploaded: true,
        failed: false,
      });
    }
  );

  it('seeds every locale under a seed version before the real version when some are partial', async () => {
    const { client, calls, uploadSourceFiles, uploadTranslations } =
      fakeClient();

    const result = await run(client, ['fr']);

    expect(calls).toEqual([
      `source ${SEED}`,
      `translations ${SEED} de,fr`,
      `source ${VERSION}`,
      `step ${VERSION} fr`,
    ]);
    expect(uploadSourceFiles.mock.calls).toEqual([
      sourceUpload(SEED),
      sourceUpload(VERSION),
    ]);
    expect(uploadTranslations.mock.calls).toEqual([
      [
        [
          {
            source: { ...source, versionId: SEED },
            translations: [
              translationFile('de', SEED),
              translationFile('fr', SEED),
            ],
          },
        ],
      ],
    ]);
    expect(stepRun).toHaveBeenCalledWith({
      files: [{ source, translations: [translationFile('fr', VERSION)] }],
    });
    expect(result).toEqual({
      seedVersionId: SEED,
      completedLocales: ['fr'],
      seededLocales: ['de'],
      sourceUploaded: true,
      failed: false,
    });
  });

  it('skips the seed with a warning when the real version already exists', async () => {
    const { client, calls } = fakeClient({ exists: true });

    const result = await run(client, ['fr']);

    expect(calls).toEqual([`step ${VERSION} fr`]);
    expect(result).toEqual({
      completedLocales: ['fr'],
      seededLocales: [],
      seedSkipped: expect.stringContaining(
        'this source version already exists on the branch'
      ),
      sourceUploaded: true,
      failed: false,
    });
    expect(logger.warn).toHaveBeenCalledWith(result.seedSkipped);
  });

  it('never passes a partly covered locale to the lockfile-writing step', async () => {
    const { client, calls } = fakeClient({ exists: true });

    const result = await run(client, [], { de: translations.de });

    expect(calls).toEqual([]);
    expect(stepRun).not.toHaveBeenCalled();
    expect(result.completedLocales).toEqual([]);
  });

  it.each([{ exists: false }, { exists: true }])(
    'passes only complete locales to the step when the real version exists is $exists',
    async ({ exists }) => {
      const { client } = fakeClient({ exists });

      await run(client, ['de']);

      expect(stepLocales()).toEqual(['de']);
    }
  );

  it('stops before the real version when the seed source fails', async () => {
    const { client, calls } = fakeClient({
      sourceResults: [{ status: 'failed', error: 'storage unavailable' }],
    });

    const result = await run(client, ['fr']);

    expect(calls).toEqual([`source ${SEED}`]);
    expect(result).toEqual({
      completedLocales: [],
      seededLocales: [],
      sourceUploaded: false,
      failed: true,
    });
    expect(getWarnings()).toEqual([
      {
        category: 'failed_upload',
        fileName: TEMPLATE_FILE_NAME,
        reason: 'storage unavailable',
      },
    ]);
  });

  it('stops before the translations when the real source fails', async () => {
    const { client, calls } = fakeClient({
      sourceResults: [{ status: 'failed', error: 'storage unavailable' }],
    });

    const result = await run(client, ['fr', 'de']);

    expect(calls).toEqual([`source ${VERSION}`]);
    expect(result).toEqual({
      completedLocales: [],
      seededLocales: [],
      sourceUploaded: false,
      failed: true,
    });
  });

  it('stops before the real version when a seed translation fails', async () => {
    const { client, calls } = fakeClient({ failedLocales: ['de'] });

    const result = await run(client, ['fr']);

    expect(calls).toEqual([`source ${SEED}`, `translations ${SEED} de,fr`]);
    expect(result).toEqual({
      seedVersionId: SEED,
      completedLocales: [],
      seededLocales: [],
      sourceUploaded: false,
      failed: true,
    });
    expect(getWarnings()).toEqual([
      {
        category: 'failed_upload',
        fileName: TEMPLATE_FILE_NAME,
        reason: 'Translation for locale de: rejected',
      },
    ]);
  });

  it('never asks the platform to force an upload', async () => {
    const { client, uploadSourceFiles, uploadTranslations } = fakeClient();

    await run(client, ['fr']);

    expect(uploadSourceFiles.mock.calls.map((call) => call[1])).toEqual([
      { sourceLocale: 'en' },
      { sourceLocale: 'en' },
    ]);
    expect(uploadTranslations.mock.calls.map((call) => call.length)).toEqual([
      1,
    ]);
    expect(JSON.stringify(uploadSourceFiles.mock.calls)).not.toContain('force');
    expect(JSON.stringify(uploadTranslations.mock.calls)).not.toContain(
      'force'
    );
  });
});
