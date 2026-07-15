import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UploadTranslationsStep } from '../UploadTranslationsStep.js';
import { logger } from '../../../console/logger.js';
import type { GT } from 'generaltranslation';
import type { Settings } from '../../../types/index.js';
import type { FileToUpload } from 'generaltranslation/types';

// Mock the GT class
const mockGt = {
  queryFileData: vi.fn(),
  uploadTranslations: vi.fn(),
};

const mockSpinner = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  message: vi.fn(),
}));

// Mock the logger
vi.mock('../../../console/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    createSpinner: () => mockSpinner,
  },
}));

const mockSettings = {
  defaultLocale: 'en',
  modelProvider: undefined,
} as unknown as Settings;

function makeSource(fileId: string): FileToUpload {
  return {
    content: `source content ${fileId}`,
    fileName: `${fileId}.json`,
    fileFormat: 'JSON',
    locale: 'en',
    fileId,
    versionId: `version-${fileId}`,
  };
}

function makeTranslation(fileId: string, locale: string): FileToUpload {
  return {
    content: `translated content ${fileId} ${locale}`,
    fileName: `${locale}/${fileId}.json`,
    fileFormat: 'JSON',
    locale,
    fileId,
    versionId: `version-${fileId}`,
  };
}

describe('UploadTranslationsStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uploads every resolved translation file, including ones that already exist on the platform', async () => {
    const files = [
      {
        source: makeSource('file-1'),
        translations: [
          makeTranslation('file-1', 'es'),
          makeTranslation('file-1', 'fr'),
        ],
      },
    ];

    // Simulate the platform already having both translations for this
    // (fileId, versionId, locale). Local files are the source of truth, so
    // they must still be uploaded (the endpoint is an upsert).
    mockGt.queryFileData.mockResolvedValue({
      translatedFiles: [
        {
          branchId: 'branch-123',
          fileId: 'file-1',
          versionId: 'version-file-1',
          locale: 'es',
        },
        {
          branchId: 'branch-123',
          fileId: 'file-1',
          versionId: 'version-file-1',
          locale: 'fr',
        },
      ],
    });
    mockGt.uploadTranslations.mockResolvedValue({
      uploadedFiles: [
        { fileId: 'file-1', locale: 'es' },
        { fileId: 'file-1', locale: 'fr' },
      ],
    });

    const step = new UploadTranslationsStep(
      mockGt as unknown as GT,
      mockSettings
    );
    const result = await step.run({ files });

    // No existence check: everything local is sent
    expect(mockGt.queryFileData).not.toHaveBeenCalled();
    expect(mockGt.uploadTranslations).toHaveBeenCalledTimes(1);
    expect(mockGt.uploadTranslations).toHaveBeenCalledWith(files, {
      sourceLocale: 'en',
      modelProvider: undefined,
    });
    expect(result).toEqual([
      { fileId: 'file-1', locale: 'es' },
      { fileId: 'file-1', locale: 'fr' },
    ]);
  });

  it('filters out files without translations before uploading', async () => {
    const withTranslations = {
      source: makeSource('file-1'),
      translations: [makeTranslation('file-1', 'es')],
    };
    const withoutTranslations = {
      source: makeSource('file-2'),
      translations: [],
    };

    mockGt.uploadTranslations.mockResolvedValue({
      uploadedFiles: [{ fileId: 'file-1', locale: 'es' }],
    });

    const step = new UploadTranslationsStep(
      mockGt as unknown as GT,
      mockSettings
    );
    await step.run({ files: [withTranslations, withoutTranslations] });

    expect(mockGt.uploadTranslations).toHaveBeenCalledWith(
      [withTranslations],
      expect.any(Object)
    );
  });

  it('skips the upload entirely when no files have translations', async () => {
    const step = new UploadTranslationsStep(
      mockGt as unknown as GT,
      mockSettings
    );
    const result = await step.run({
      files: [{ source: makeSource('file-1'), translations: [] }],
    });

    expect(result).toEqual([]);
    expect(mockGt.queryFileData).not.toHaveBeenCalled();
    expect(mockGt.uploadTranslations).not.toHaveBeenCalled();
  });

  it('reports the server-confirmed number of uploaded translation files', async () => {
    const files = [
      {
        source: makeSource('file-1'),
        translations: [
          makeTranslation('file-1', 'es'),
          makeTranslation('file-1', 'fr'),
        ],
      },
      {
        source: makeSource('file-2'),
        translations: [makeTranslation('file-2', 'es')],
      },
    ];

    mockGt.uploadTranslations.mockResolvedValue({
      uploadedFiles: [
        { fileId: 'file-1', locale: 'es' },
        { fileId: 'file-1', locale: 'fr' },
        { fileId: 'file-2', locale: 'es' },
      ],
    });

    const step = new UploadTranslationsStep(
      mockGt as unknown as GT,
      mockSettings
    );
    await step.run({ files });

    expect(mockSpinner.stop).toHaveBeenCalledWith(
      expect.stringContaining('Uploaded 3 translation files')
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('warns when the server persists fewer files than were uploaded', async () => {
    const files = [
      {
        source: makeSource('file-1'),
        translations: [
          makeTranslation('file-1', 'es'),
          makeTranslation('file-1', 'fr'),
        ],
      },
      {
        source: makeSource('file-2'),
        translations: [makeTranslation('file-2', 'es')],
      },
    ];

    // The endpoint silently drops files it failed to persist (no error,
    // just a smaller uploadedFiles array)
    mockGt.uploadTranslations.mockResolvedValue({
      uploadedFiles: [
        { fileId: 'file-1', locale: 'es' },
        { fileId: 'file-2', locale: 'es' },
      ],
    });

    const step = new UploadTranslationsStep(
      mockGt as unknown as GT,
      mockSettings
    );
    const result = await step.run({ files });

    expect(result).toHaveLength(2);
    expect(mockSpinner.stop).toHaveBeenCalledWith(
      expect.stringContaining('Uploaded 2 translation files')
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('1 translation file was not persisted')
    );
  });
});
