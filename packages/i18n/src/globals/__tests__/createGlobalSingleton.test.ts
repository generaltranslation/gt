import { beforeEach, describe, expect, it } from 'vitest';
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
});
