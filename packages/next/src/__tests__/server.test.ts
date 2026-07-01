import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

type TestGlobal = typeof globalThis & {
  __generaltranslation?: {
    i18n?: Record<string, unknown>;
    next?: Record<string, unknown>;
    [key: string]: unknown;
  };
};

function resetGTGlobals() {
  const globalObj = globalThis as TestGlobal;
  if (globalObj.__generaltranslation?.i18n) {
    Reflect.deleteProperty(globalObj.__generaltranslation.i18n, 'i18nConfig');
    Reflect.deleteProperty(globalObj.__generaltranslation.i18n, 'i18nCache');
    Reflect.deleteProperty(
      globalObj.__generaltranslation.i18n,
      'conditionStore'
    );
  }
  if (globalObj.__generaltranslation?.next) {
    Reflect.deleteProperty(globalObj.__generaltranslation.next, 'localeStore');
  }
}

describe('server entrypoint', () => {
  beforeEach(() => {
    resetGTGlobals();
    vi.resetModules();
  });

  it('initializes request globals when imported directly', async () => {
    const { isI18nConfigInitialized } = await import('gt-i18n/internal');

    expect(isI18nConfigInitialized()).toBe(false);

    await import('../server');

    const { getAsyncConditionStore } =
      await import('../condition-store/AsyncConditionStore');

    expect(isI18nConfigInitialized()).toBe(true);
    expect(() => getAsyncConditionStore()).not.toThrow();
  });

  it('initializes a missing condition store without replacing the i18n config', async () => {
    const { getI18nConfig, initializeI18nConfig } =
      await import('gt-i18n/internal');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const config = initializeI18nConfig({ defaultLocale: 'en' });

    await import('../server');

    const { getAsyncConditionStore } =
      await import('../condition-store/AsyncConditionStore');

    expect(getI18nConfig()).toBe(config);
    expect(() => getAsyncConditionStore()).not.toThrow();
    expect(warn).not.toHaveBeenCalled();
  });
});
