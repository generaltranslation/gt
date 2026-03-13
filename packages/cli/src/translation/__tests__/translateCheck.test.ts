import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getTranslateCheckJson } from '../translateCheck.js';
import { generateSettings } from '../../config/generateSettings.js';
import { checkFiles } from '../../formats/files/checkFiles.js';
import type { TranslateCheckResult } from '../../formats/files/checkFiles.js';

vi.mock('../../config/generateSettings.js');
vi.mock('../../formats/files/checkFiles.js');

const mockGenerateSettings = vi.mocked(generateSettings);
const mockCheckFiles = vi.mocked(checkFiles);

describe('getTranslateCheckJson', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should resolve settings and delegate to checkFiles', async () => {
    const fakeSettings = { defaultLocale: 'en' } as any;
    const fakeResult: TranslateCheckResult = {
      validFiles: ['en/common.json'],
      skippedFiles: [],
      summary: { total: 1, valid: 1, skipped: 0 },
    };
    mockGenerateSettings.mockResolvedValue(fakeSettings);
    mockCheckFiles.mockResolvedValue(fakeResult);

    const result = await getTranslateCheckJson({ config: 'gt.config.json' });

    expect(mockGenerateSettings).toHaveBeenCalledWith({
      config: 'gt.config.json',
    });
    expect(mockCheckFiles).toHaveBeenCalledWith(fakeSettings);
    expect(result).toEqual(fakeResult);
  });

  it('should pass empty object when no options provided', async () => {
    const fakeSettings = {} as any;
    const fakeResult: TranslateCheckResult = {
      validFiles: [],
      skippedFiles: [],
      summary: { total: 0, valid: 0, skipped: 0 },
    };
    mockGenerateSettings.mockResolvedValue(fakeSettings);
    mockCheckFiles.mockResolvedValue(fakeResult);

    await getTranslateCheckJson();

    expect(mockGenerateSettings).toHaveBeenCalledWith({});
  });

  it('should forward defaultLocale option to generateSettings', async () => {
    const fakeSettings = { defaultLocale: 'fr' } as any;
    const fakeResult: TranslateCheckResult = {
      validFiles: [],
      skippedFiles: [],
      summary: { total: 0, valid: 0, skipped: 0 },
    };
    mockGenerateSettings.mockResolvedValue(fakeSettings);
    mockCheckFiles.mockResolvedValue(fakeResult);

    await getTranslateCheckJson({ defaultLocale: 'fr' });

    expect(mockGenerateSettings).toHaveBeenCalledWith({ defaultLocale: 'fr' });
  });

  it('should return skipped files from checkFiles', async () => {
    const fakeSettings = {} as any;
    const fakeResult: TranslateCheckResult = {
      validFiles: ['valid.json'],
      skippedFiles: [
        { fileName: 'broken.json', reason: 'JSON file is not parsable' },
      ],
      summary: { total: 2, valid: 1, skipped: 1 },
    };
    mockGenerateSettings.mockResolvedValue(fakeSettings);
    mockCheckFiles.mockResolvedValue(fakeResult);

    const result = await getTranslateCheckJson();

    expect(result.skippedFiles).toHaveLength(1);
    expect(result.skippedFiles[0].fileName).toBe('broken.json');
    expect(result.summary.skipped).toBe(1);
  });
});
