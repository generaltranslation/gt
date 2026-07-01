import { beforeEach, describe, expect, it, vi } from 'vitest';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: {
    next?: Record<string, unknown>;
    [key: string]: unknown;
  };
};

function resetNextGlobals() {
  const globalObj = globalThis as TestGlobal;
  if (globalObj.__generaltranslation?.next) {
    Reflect.deleteProperty(globalObj.__generaltranslation.next, 'localeStore');
  }
}

describe('localeStore', () => {
  beforeEach(() => {
    resetNextGlobals();
    vi.resetModules();
  });

  it('reuses the same store after the module is loaded again', async () => {
    const firstModule = await import('../localeStore');

    vi.resetModules();

    const secondModule = await import('../localeStore');

    expect(secondModule.localeStore).toBe(firstModule.localeStore);
  });
});
