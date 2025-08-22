import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CheckFileTranslationData,
  checkFileTranslations,
} from '../checkFileTranslations.js';
import { gt } from '../../utils/gt.js';
import { downloadFile } from '../downloadFile.js';
import { createOraSpinner } from '../../console/logging.js';
import { Ora } from 'ora';
import {
  CheckFileTranslationsResult,
  CompletedFileTranslationData,
} from 'generaltranslation/types';
import { getLocaleProperties } from 'generaltranslation';
import { createMockSettings } from '../__mocks__/settings.js';

// Mock dependencies
vi.mock('../../utils/gt.js', () => ({
  gt: {
    checkFileTranslations: vi.fn(),
  },
}));

vi.mock('../downloadFile.js', () => ({
  downloadFile: vi.fn(),
}));

vi.mock('../downloadFileBatch.js', () => ({
  downloadFileBatch: vi.fn(),
}));

vi.mock('../../console/logging.js', () => ({
  createOraSpinner: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('generaltranslation', () => ({
  getLocaleProperties: vi.fn(),
}));

describe('checkFileTranslations', () => {
  // Common mock data factories
  const createMockSpinner = (): Ora =>
    ({
      text: '',
      succeed: vi.fn(),
      fail: vi.fn(),
      start: vi.fn(),
    }) as unknown as Ora;

  const createMockDownloadStatus = () => ({
    downloaded: new Set<string>(),
    failed: new Set<string>(),
  });

  const createMockResolveOutputPath = () =>
    vi.fn(
      (sourcePath: string, locale: string) =>
        `/output/${sourcePath}_${locale}.json`
    );

  const createMockFileData = (overrides: CheckFileTranslationData = {}) => ({
    'file1.json': { versionId: 'v1', fileName: 'file1.json' },
    ...overrides,
  });

  const createMockTranslation = (
    overrides: Partial<CompletedFileTranslationData> = {}
  ) => ({
    isReady: true,
    fileName: 'file1.json',
    locale: 'es',
    id: 'translation-1',
    metadata: {},
    fileId: 'file-1',
    versionId: 'v1',
    downloadUrl:
      'https://api.test.com/v2/project/translations/files/translation-1',
    ...overrides,
  });

  const createMockTranslationsResult = (
    translations: CompletedFileTranslationData[] = []
  ): CheckFileTranslationsResult => ({
    translations,
  });

  const createMockLocaleProperties = (locale: string) => {
    const localeMap: Record<
      string,
      { name: string; nativeName: string; region: string; nativeRegion: string }
    > = {
      es: {
        name: 'Spanish',
        nativeName: 'Español',
        region: 'Spain',
        nativeRegion: 'España',
      },
      fr: {
        name: 'French',
        nativeName: 'Français',
        region: 'France',
        nativeRegion: 'France',
      },
    };

    const localeInfo = localeMap[locale] || {
      name: locale,
      nativeName: locale,
      region: locale,
      nativeRegion: locale,
    };

    return {
      code: locale,
      name: localeInfo.name,
      englishName: localeInfo.name,
      nativeName: localeInfo.nativeName,
      direction: 'ltr' as const,
      family: 'Indo-European',
      script: 'Latin',
      languageCode: locale,
      languageName: localeInfo.name,
      nativeLanguageName: localeInfo.nativeName,
      nameWithRegionCode: `${localeInfo.name} (${locale.toUpperCase()})`,
      regionCode: locale.toUpperCase(),
      regionName: localeInfo.region,
      nativeNameWithRegionCode: `${localeInfo.nativeName} (${locale.toUpperCase()})`,
      nativeRegionName: localeInfo.nativeRegion,
      scriptCode: 'Latn',
      scriptName: 'Latin',
      nativeScriptName: 'Latn',
      maximizedCode: locale,
      maximizedName: localeInfo.name,
      nativeMaximizedName: localeInfo.nativeName,
      nativeMaximizedNameWithRegionCode: `${localeInfo.nativeName} (${locale.toUpperCase()})`,
      minimizedCode: locale,
      minimizedName: localeInfo.name,
      nativeMinimizedName: localeInfo.nativeName,
      nativeMinimizedNameWithRegionCode: `${localeInfo.nativeName} (${locale.toUpperCase()})`,
      emoji: '',
      emojiRegionCode: '',
      emojiRegionName: '',
      emojiNativeName: '',
      emojiNativeRegionName: '',
      emojiNativeRegionCode: '',
    };
  };

  let mockSpinner: Ora;
  let mockDownloadStatus: ReturnType<typeof createMockDownloadStatus>;
  let mockResolveOutputPath: ReturnType<typeof createMockResolveOutputPath>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSpinner = createMockSpinner();
    mockDownloadStatus = createMockDownloadStatus();
    mockResolveOutputPath = createMockResolveOutputPath();
    vi.mocked(createOraSpinner).mockResolvedValue(mockSpinner);

    // Mock getLocaleProperties using the factory function
    vi.mocked(getLocaleProperties).mockImplementation(
      createMockLocaleProperties
    );
  });

  it('should handle empty data', async () => {
    const mockData = {};

    const result = await checkFileTranslations(
      mockData,
      ['es', 'fr'],
      30000,
      mockResolveOutputPath,
      createMockSettings()
    );

    expect(mockSpinner.start).toHaveBeenCalledWith(
      'Waiting for translation...'
    );
    expect(result).toBe(true);
  });

  it('should start spinner when called', async () => {
    const mockData = createMockFileData();
    const mockTranslation = createMockTranslation();
    const mockTranslationsResult = createMockTranslationsResult([
      mockTranslation,
    ]);

    vi.mocked(gt.checkFileTranslations).mockResolvedValue(
      mockTranslationsResult
    );
    vi.mocked(downloadFile).mockResolvedValue(true);

    await checkFileTranslations(
      mockData,
      ['es'],
      30000,
      mockResolveOutputPath,
      createMockSettings()
    );

    expect(mockSpinner.start).toHaveBeenCalledWith(
      'Waiting for translation...'
    );
  });

  it('should handle single file download', async () => {
    const mockData = createMockFileData();
    const mockTranslation = createMockTranslation();
    const mockTranslations = createMockTranslationsResult([mockTranslation]);

    vi.mocked(gt.checkFileTranslations).mockResolvedValue(mockTranslations);
    vi.mocked(downloadFile).mockResolvedValue(true);

    const result = await checkFileTranslations(
      mockData,
      ['es'],
      30000,
      mockResolveOutputPath,
      createMockSettings()
    );

    expect(downloadFile).toHaveBeenCalledWith(
      'translation-1',
      '/output/file1.json_es.json',
      'file1.json',
      'es',
      createMockSettings()
    );
    expect(result).toBe(true);
  });

  it('should call gt.checkFileTranslations with correct parameters', async () => {
    const mockData = createMockFileData();
    const mockTranslation = createMockTranslation();
    const mockTranslationsResult = createMockTranslationsResult([
      mockTranslation,
    ]);

    vi.mocked(gt.checkFileTranslations).mockResolvedValue(
      mockTranslationsResult
    );
    vi.mocked(downloadFile).mockResolvedValue(true);

    await checkFileTranslations(
      mockData,
      ['es'],
      30000,
      mockResolveOutputPath,
      createMockSettings()
    );

    expect(gt.checkFileTranslations).toHaveBeenCalledWith([
      { versionId: 'v1', fileName: 'file1.json', locale: 'es' },
    ]);
  });
});
