import { afterEach, expect, it, vi } from 'vitest';
import { nativeStoreGet, nativeStoreSet } from '../nativeStore';

vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
  TurboModuleRegistry: {
    getEnforcing: () => {
      throw new Error('Native module is unavailable on web');
    },
  },
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

it('nativeStore reads and writes through localStorage on web', () => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  });

  expect(() => nativeStoreSet('gt-locale', 'fr')).not.toThrow();
  expect(nativeStoreGet('gt-locale')).toBe('fr');
});
