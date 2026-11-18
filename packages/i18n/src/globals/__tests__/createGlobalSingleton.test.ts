import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGlobalSingleton } from '../createGlobalSingleton';
import type { I18nCache } from '../../i18n-cache/I18nCache';

type GlobalRegistry = Record<string, Record<string, unknown> | undefined>;

const registry = () =>
  ((
    globalThis as { __generaltranslation?: GlobalRegistry }
  ).__generaltranslation ??= {});

function createTestSingleton() {
  return createGlobalSingleton<{ id: string }>({
    namespace: 'testGlobalSingleton',
    key: 'singleton',
    notInitialized: () => 'singleton missing',
  });
}

beforeEach(() => {
  Reflect.deleteProperty(globalThis, '__generaltranslation');
});

describe('createGlobalSingleton', () => {
  it.each([undefined, null])(
    'throws its diagnostic while the registry slot is %s',
    (slot) => {
      const singleton = createTestSingleton();
      registry().testGlobalSingleton = { singleton: slot };

      expect(singleton.isInitialized()).toBe(false);
      expect(() => singleton.get()).toThrow('singleton missing');
    }
  );

  it('replaces the instance and keeps the other fields of its namespace', () => {
    registry().testGlobalSingleton = { marker: true };
    const singleton = createTestSingleton();
    const value = { id: 'second' };

    singleton.set({ id: 'first' });
    singleton.set(value);

    expect(singleton.get()).toBe(value);
    // A separately created handle, like a second copy of the module, shares it.
    expect(createTestSingleton().get()).toBe(value);
    expect(registry().testGlobalSingleton?.marker).toBe(true);
  });
});

// Each wrapper keeps its instance on globalThis, never in module scope, so it
// survives a module reload (duplicate bundles, HMR).
describe.each([
  {
    name: 'i18nCache',
    notInitialized: 'Cannot read I18nCache before it has been initialized',
    load: async () => {
      const { getI18nCache, setI18nCache } =
        await import('../../i18n-cache/singleton-operations');
      return { get: getI18nCache, set: setI18nCache };
    },
    create: () => ({}) as I18nCache,
  },
  {
    name: 'i18nConfig',
    notInitialized: 'Cannot read I18nConfig before it has been initialized',
    load: async () => {
      const { getI18nConfig, setI18nConfig } =
        await import('../../i18n-config/singleton-operations');
      return { get: getI18nConfig, set: setI18nConfig };
    },
    create: () => ({}),
  },
  {
    name: 'conditionStore',
    notInitialized: 'condition store not initialized',
    load: async () => {
      const { createConditionStoreSingleton } =
        await import('../../condition-store/createConditionStoreSingleton');
      const singleton = createConditionStoreSingleton(
        'condition store not initialized'
      );
      return {
        get: singleton.getConditionStore,
        set: singleton.setConditionStore,
      };
    },
    create: () => ({ getLocale: () => 'en' }),
  },
])('$name singleton', ({ notInitialized, load, create }) => {
  it('throws before it is set, then shares its instance with a reloaded module, which can replace it', async () => {
    const first = await load();
    expect(() => first.get()).toThrow(notInitialized);

    const instance = create();
    first.set(instance as never);
    vi.resetModules();
    const reloaded = await load();
    expect(reloaded.get()).toBe(instance);

    const replacement = create();
    reloaded.set(replacement as never);

    expect(first.get()).toBe(replacement);
  });
});

describe('i18nConfig singleton', () => {
  it('initializes a config and reports whether one exists', async () => {
    const { getI18nConfig, initializeI18nConfig, isI18nConfigInitialized } =
      await import('../../i18n-config/singleton-operations');
    expect(isI18nConfigInitialized()).toBe(false);

    const config = initializeI18nConfig({
      defaultLocale: 'fr',
      projectId: 'test-project',
    });

    expect(isI18nConfigInitialized()).toBe(true);
    expect(getI18nConfig()).toBe(config);
    expect(getI18nConfig().getLocales()).toEqual(['fr']);
    expect(getI18nConfig().isGTServicesEnabled()).toBe(true);
  });
});
