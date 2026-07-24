import { GTRuntime } from 'generaltranslation/runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig } from '../../i18n-config/singleton-operations';
import { hashMessage } from '../../utils/hashMessage';
import { RuntimeTranslationResolver } from '../RuntimeTranslationResolver';
import { SnapshotStore } from '../SnapshotStore';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: unknown;
};

describe('RuntimeTranslationResolver', () => {
  beforeEach(() => {
    Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
    vi.restoreAllMocks();
    initializeI18nConfig({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      projectId: 'test-project',
      devApiKey: 'test-dev-key',
    });
  });

  it('resolves a miss and writes it into the snapshot store', async () => {
    const message = 'Hello';
    const options = { $format: 'ICU' as const };
    const hash = hashMessage(message, options);
    const translateMany = vi
      .spyOn(GTRuntime.prototype, 'translateMany')
      .mockResolvedValue({
        [hash]: { success: true, translation: 'Bonjour' },
      } as never);
    const snapshots = new SnapshotStore();
    const resolver = new RuntimeTranslationResolver(snapshots, {
      batchConfig: { batchInterval: 1 },
    });

    await expect(
      resolver.lookupTranslationWithFallback('fr', message, options)
    ).resolves.toBe('Bonjour');
    expect(translateMany).toHaveBeenCalledWith(
      expect.objectContaining({ [hash]: expect.any(Object) }),
      expect.objectContaining({ targetLocale: 'fr' }),
      expect.any(Number)
    );
    expect(snapshots.lookupTranslation('fr', message, options)).toBe('Bonjour');
  });
});
