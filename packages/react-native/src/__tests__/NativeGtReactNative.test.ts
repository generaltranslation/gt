import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A steerable react-native mock. On web (react-native-web / Expo web) the native
// module is never registered, so TurboModuleRegistry.getEnforcing throws. These
// tests drive Platform.OS and the getEnforcing behavior to cover both platforms.
// The mock functions live in vi.hoisted() so they survive vi.resetModules() and
// stay the same instances the re-imported module receives.
const rn = vi.hoisted(() => ({
  os: 'web' as 'web' | 'ios' | 'android',
  getEnforcing: vi.fn(),
  get: vi.fn(),
}));

vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return rn.os;
    },
  },
  TurboModuleRegistry: {
    getEnforcing: rn.getEnforcing,
    get: rn.get,
  },
}));

const nativeModuleMissing = () => {
  throw new Error(
    "TurboModuleRegistry.getEnforcing(...): 'GtReactNative' could not be found. " +
      'Verify that a module by this name is registered in the native binary.'
  );
};

describe('NativeGtReactNative resolution', () => {
  beforeEach(() => {
    vi.resetModules();
    rn.getEnforcing.mockReset();
    rn.get.mockReset();
    rn.os = 'web';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not throw at import time on web when the native module is absent', async () => {
    rn.os = 'web';
    rn.getEnforcing.mockImplementation(nativeModuleMissing);

    await expect(import('../NativeGtReactNative')).resolves.toBeDefined();
  });

  it('resolves GtReactNative to null on web without calling getEnforcing', async () => {
    rn.os = 'web';
    rn.getEnforcing.mockImplementation(nativeModuleMissing);

    const mod = await import('../NativeGtReactNative');

    expect(mod.GtReactNative).toBeNull();
    expect(rn.getEnforcing).not.toHaveBeenCalled();
  });

  it('resolves the native TurboModule on native platforms', async () => {
    const nativeModule = {
      multiply: () => 6,
      getNativeLocales: () => ['fr'],
      nativeStoreGet: () => null,
      nativeStoreSet: () => {},
    };
    rn.os = 'ios';
    rn.getEnforcing.mockReturnValue(nativeModule);

    const mod = await import('../NativeGtReactNative');

    expect(mod.GtReactNative).toBe(nativeModule);
    expect(rn.getEnforcing).toHaveBeenCalledWith('GtReactNative');
  });

  it('still throws at import on a misconfigured native build (getEnforcing stays enforced)', async () => {
    rn.os = 'android';
    rn.getEnforcing.mockImplementation(nativeModuleMissing);

    await expect(import('../NativeGtReactNative')).rejects.toThrow(
      /could not be found/
    );
  });
});

describe('native utilities degrade on web without the native module', () => {
  beforeEach(() => {
    vi.resetModules();
    rn.getEnforcing.mockReset();
    rn.get.mockReset();
    rn.os = 'web';
    rn.getEnforcing.mockImplementation(nativeModuleMissing);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    // @ts-expect-error remove the localStorage shim injected by a test
    delete globalThis.localStorage;
  });

  it('getNativeLocales returns an array instead of crashing on import', async () => {
    const { getNativeLocales } = await import('../utils/getNativeLocales');

    expect(() => getNativeLocales()).not.toThrow();
    expect(Array.isArray(getNativeLocales())).toBe(true);
  });

  it('getNativeLocales returns navigator.languages on web', async () => {
    vi.stubGlobal('navigator', {
      languages: ['fr-FR', 'fr'],
      language: 'fr-FR',
    });

    const { getNativeLocales } = await import('../utils/getNativeLocales');

    expect(getNativeLocales()).toEqual(['fr-FR', 'fr']);
  });

  it('nativeStore reads and writes through localStorage on web', async () => {
    const store = new Map<string, string>();
    // @ts-expect-error minimal localStorage shim for the web path
    globalThis.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
    };

    const { nativeStoreGet, nativeStoreSet } =
      await import('../utils/nativeStore');

    expect(() => nativeStoreSet('gt-locale', 'fr')).not.toThrow();
    expect(nativeStoreGet('gt-locale')).toBe('fr');
  });
});
