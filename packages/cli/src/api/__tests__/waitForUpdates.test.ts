import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { waitForUpdates } from '../waitForUpdates.js';
import { gt } from '../../utils/gt.js';
import { createOraSpinner, logErrorAndExit } from '../../console/logging.js';
import { Ora } from 'ora';
import { TranslationStatusResult } from 'generaltranslation/types';

// Mock dependencies
vi.mock('../../utils/gt.js', () => ({
  gt: {
    checkTranslationStatus: vi.fn(),
  },
}));

vi.mock('../../console/logging.js', () => ({
  createOraSpinner: vi.fn(),
  logErrorAndExit: vi.fn(),
}));

describe('waitForUpdates', () => {
  const mockSpinner: Ora = {
    start: vi.fn(),
    stop: vi.fn(),
    succeed: vi.fn(),
    fail: vi.fn(),
    text: '',
  } as unknown as Ora;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createOraSpinner).mockResolvedValue(mockSpinner);
    vi.mocked(logErrorAndExit).mockImplementation(() => {
      throw new Error('Exit called');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should resolve true when all translations are available immediately', async () => {
    const mockStatus: TranslationStatusResult = {
      availableLocales: ['es', 'fr'],
      locales: ['es', 'fr'],
      localesWaitingForApproval: [],
      count: 0,
    };

    vi.mocked(gt.checkTranslationStatus).mockResolvedValue(mockStatus);

    const result = await waitForUpdates('version-456', Date.now(), 30000);

    expect(gt.checkTranslationStatus).toHaveBeenCalledWith('version-456');
    expect(mockSpinner.start).toHaveBeenCalledWith(
      'Waiting for translation...'
    );
    expect(mockSpinner.succeed).toHaveBeenCalledWith(
      expect.stringContaining('All translations are live!')
    );
    expect(result).toBe(true);
  });

  it('should exit with error when locales are waiting for approval', async () => {
    const mockStatus: TranslationStatusResult = {
      availableLocales: ['es'],
      locales: ['es', 'fr'],
      localesWaitingForApproval: ['fr'],
      count: 0,
    };

    vi.mocked(gt.checkTranslationStatus).mockResolvedValue(mockStatus);

    await expect(
      waitForUpdates('version-456', Date.now(), 30000)
    ).rejects.toThrow('Exit called');

    expect(mockSpinner.stop).toHaveBeenCalled();
    expect(logErrorAndExit).toHaveBeenCalledWith(
      expect.stringContaining('1 translations are waiting for approval')
    );
  });

  it('should exit with error when multiple locales are waiting for approval', async () => {
    const mockStatus: TranslationStatusResult = {
      availableLocales: [],
      locales: ['es', 'fr', 'de'],
      localesWaitingForApproval: ['es', 'fr'],
      count: 0,
    };

    vi.mocked(gt.checkTranslationStatus).mockResolvedValue(mockStatus);

    await expect(
      waitForUpdates('version-456', Date.now(), 30000)
    ).rejects.toThrow('Exit called');

    expect(logErrorAndExit).toHaveBeenCalledWith(
      expect.stringContaining('2 translations are waiting for approval')
    );
  });

  it('should call gt.checkTranslationStatus with correct versionId', async () => {
    const mockStatus: TranslationStatusResult = {
      availableLocales: ['es', 'fr'],
      locales: ['es', 'fr'],
      localesWaitingForApproval: [],
      count: 0,
    };

    vi.mocked(gt.checkTranslationStatus).mockResolvedValue(mockStatus);

    await waitForUpdates('version-456', Date.now(), 30000);

    expect(gt.checkTranslationStatus).toHaveBeenCalledWith('version-456');
  });

  it('should handle empty locales array', async () => {
    const mockStatus: TranslationStatusResult = {
      count: 0,
      availableLocales: [],
      locales: [], // No locales expected
      localesWaitingForApproval: [],
    };

    vi.mocked(gt.checkTranslationStatus).mockResolvedValue(mockStatus);

    const result = await waitForUpdates('version-456', Date.now(), 30000);

    expect(result).toBe(true);
    expect(mockSpinner.succeed).toHaveBeenCalledWith(
      expect.stringContaining('All translations are live!')
    );
  });

  it('should handle case where availableLocales contains extra locales', async () => {
    const mockStatus: TranslationStatusResult = {
      availableLocales: ['es', 'fr', 'de'], // Extra locale 'de'
      locales: ['es', 'fr'],
      localesWaitingForApproval: [],
      count: 0,
    };

    vi.mocked(gt.checkTranslationStatus).mockResolvedValue(mockStatus);

    const result = await waitForUpdates('version-456', Date.now(), 30000);

    expect(result).toBe(true);
    expect(mockSpinner.succeed).toHaveBeenCalledWith(
      expect.stringContaining('All translations are live!')
    );
  });

  it('should start spinner with correct message', async () => {
    const mockStatus: TranslationStatusResult = {
      availableLocales: ['es', 'fr'],
      locales: ['es', 'fr'],
      localesWaitingForApproval: [],
      count: 0,
    };

    vi.mocked(gt.checkTranslationStatus).mockResolvedValue(mockStatus);

    const result = await waitForUpdates('version-456', Date.now(), 30000);

    expect(mockSpinner.start).toHaveBeenCalledWith(
      'Waiting for translation...'
    );
    expect(result).toBe(true);
  });
});
