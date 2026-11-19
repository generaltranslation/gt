import { beforeEach, describe, expect, it, vi } from 'vitest';
import { derive } from 'gt-i18n';
import { initializeI18nConfig } from 'gt-i18n/internal';
import { usePrepareT } from '../usePrepareT';

const memoKeys = vi.hoisted(() => [] as unknown[][]);

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useMemo: <T>(factory: () => T, keys: unknown[]): T => {
    memoKeys.push(keys);
    return factory();
  },
}));

vi.mock('../../../hooks/condition-store', () => ({
  useEnableI18n: () => true,
  useLocale: () => 'fr',
}));

vi.mock('../../../hooks/i18n-config', () => ({
  useDefaultLocale: () => 'en',
}));

type TestGlobal = typeof globalThis & { __generaltranslation?: unknown };

describe('usePrepareT', () => {
  beforeEach(() => {
    Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
    initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr'] });
    memoKeys.length = 0;
  });

  it('prepares context={derive(text)} like context={text}, and memoizes on the text', () => {
    const [derived, literal] = [derive('formal'), 'formal'].map(
      (context) =>
        usePrepareT({ sourceChildren: 'Hello', params: { context } })
          .targetOptions
    );

    expect(derived).toEqual(literal);
    expect(memoKeys[0]).toEqual(memoKeys[1]);
  });
});
