import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGlobalSingleton } from '../createGlobalSingleton';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: {
    testGlobalSingleton?: {
      singleton?: unknown;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
};

function resetTestGlobalSingleton() {
  const globalObj = globalThis as TestGlobal;
  if (globalObj.__generaltranslation?.testGlobalSingleton) {
    Reflect.deleteProperty(
      globalObj.__generaltranslation.testGlobalSingleton,
      'singleton'
    );
  }
}

describe('createGlobalSingleton', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resetTestGlobalSingleton();
  });

  it('treats null registry slots as uninitialized', () => {
    const singleton = createGlobalSingleton<{ id: string }>({
      namespace: 'testGlobalSingleton',
      key: 'singleton',
      source: 'gt-i18n',
      notInitialized: () => 'singleton missing',
    });
    const globalObj = globalThis as TestGlobal;
    globalObj.__generaltranslation ??= {};
    globalObj.__generaltranslation.testGlobalSingleton = {
      singleton: null,
    };

    expect(singleton.isInitialized()).toBe(false);
    expect(() => singleton.get()).toThrow('singleton missing');
  });

  it('preserves an existing singleton instance', () => {
    const singleton = createGlobalSingleton<{ id: string }>({
      namespace: 'testGlobalSingleton',
      key: 'singleton',
      source: 'gt-i18n',
      notInitialized: () => 'singleton missing',
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const value = { id: 'first' };

    singleton.set(value);
    singleton.set({ id: 'second' });

    expect(warn).not.toHaveBeenCalled();
    expect(singleton.get()).toBe(value);
  });

  it('warns about existing singleton instances when debug logging is enabled', () => {
    vi.stubEnv('_GENERALTRANSLATION_LOG_LEVEL', 'DEBUG');
    const singleton = createGlobalSingleton<{ id: string }>({
      namespace: 'testGlobalSingleton',
      key: 'singleton',
      source: 'gt-i18n',
      notInitialized: () => 'singleton missing',
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const value = { id: 'first' };

    singleton.set(value);
    singleton.set({ id: 'second' });

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Global singleton singleton instance was already initialized'
      )
    );
    expect(singleton.get()).toBe(value);
  });
});
