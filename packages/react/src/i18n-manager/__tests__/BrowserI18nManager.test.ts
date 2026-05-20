import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashMessage } from '../../../../i18n/src/utils/hashMessage';
import { BrowserI18nManager } from '../BrowserI18nManager';

const mockTranslateMany = vi.hoisted(() => vi.fn());

vi.mock('gt-i18n/internal', async () => {
  return await import('../../../../i18n/src/internal');
});

vi.mock(
  '../../../../i18n/src/i18n-manager/translations-manager/utils/createTranslateMany',
  () => ({
    createTranslateManyFactory: vi
      .fn()
      .mockReturnValue(() => mockTranslateMany),
  })
);

const FLUSH_INTERVAL = 500;

const mockStorage = new Map<string, string>();
const mockLocalStorage = {
  getItem: vi.fn((key: string) => mockStorage.get(key) ?? null),
  setItem: vi.fn((key: string, val: string) => mockStorage.set(key, val)),
  removeItem: vi.fn((key: string) => mockStorage.delete(key)),
};

describe('BrowserI18nManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv('DEV', true);
    vi.stubGlobal('localStorage', mockLocalStorage);
    mockStorage.clear();
    vi.clearAllMocks();
    mockTranslateMany.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('persists runtime translation misses to localStorage through the subscription api', async () => {
    const message = 'Hello';
    const options = { $format: 'ICU' } as const;
    const hash = hashMessage(message, options);

    mockTranslateMany.mockResolvedValue({
      [hash]: {
        success: true,
        translation: 'Hola',
      },
    });

    const manager = new BrowserI18nManager({
      defaultLocale: 'en',
      locales: ['en', 'es'],
      environment: 'development',
      projectId: 'project-id',
      devApiKey: 'dev-api-key',
      loadTranslations: vi.fn().mockResolvedValue({}),
      batchConfig: {
        maxBatchSize: 1,
      },
    });

    const result = await manager.lookupTranslationWithFallback(
      'es',
      message,
      options
    );
    vi.advanceTimersByTime(FLUSH_INTERVAL);

    const stored = JSON.parse(mockStorage.get('gt:tx:project-id:es') ?? '{}');

    expect(result).toBe('Hola');
    expect(stored[hash]).toMatchObject({
      t: 'Hola',
    });
  });
});
