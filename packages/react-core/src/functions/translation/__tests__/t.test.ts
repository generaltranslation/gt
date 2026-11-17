import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactI18nCache } from '../../../i18n-cache/ReactI18nCache';
import { setReactI18nCache } from '../../../i18n-cache/singleton-operations';
import { setReadonlyConditionStore } from '../../../condition-store/singleton-operations';
import {
  initializeI18nConfig,
  type RenderStrategy,
} from '../../../setup/i18nConfig';
import { t } from '../t';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: unknown;
};

function resetGTGlobals() {
  Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
}

const lookupTranslation = vi.fn();

function setup(renderStrategy: RenderStrategy = 'SPA', locale = 'en') {
  initializeI18nConfig(
    {
      defaultLocale: 'en',
      locales: ['en', 'fr'],
    },
    renderStrategy
  );
  setConditions(locale);
  setReactI18nCache({
    lookupTranslation,
  } as unknown as ReactI18nCache);
}

function setConditions(locale: string) {
  setReadonlyConditionStore({
    getLocale: () => locale,
    getRegion: () => undefined,
    getEnableI18n: () => true,
    setLocale: () => {},
    setRegion: () => {},
    setEnableI18n: () => {},
  });
}

describe('t', () => {
  beforeEach(() => {
    resetGTGlobals();
    lookupTranslation.mockReset();
    setup();
  });

  it('interpolates source strings when translation is not required', () => {
    expect(t('hello, {name}', { name: 'brian' })).toBe('hello, brian');
  });

  it('keeps tagged template literal lookup in string format', () => {
    t`hello, ${'brian'}`;

    expect(lookupTranslation).toHaveBeenCalledWith('en', 'hello, brian', {
      $format: 'STRING',
    });
  });
});

describe('t outside a client-rendered (SPA) app', () => {
  beforeEach(() => {
    resetGTGlobals();
    lookupTranslation.mockReset();
    lookupTranslation.mockReturnValue('Bonjour, {name} !');
    initializeI18nConfig(
      { defaultLocale: 'en', locales: ['en', 'fr'] },
      'server-render'
    );
  });

  it.each([
    ['at module level, before GT has a locale', () => {}],
    ['once the condition store is initialized', () => setConditions('fr')],
  ])('throws in development %s', (_, arrange) => {
    vi.stubEnv('NODE_ENV', 'development');
    arrange();
    try {
      expect(() => t('Hello, {name}!', { name: 'Ann' })).toThrow(
        /only available in client-rendered \(SPA\) apps/
      );
      expect(() => t`Hello, ${'Ann'}!`).toThrow(/Message: "Hello, !"/);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('logs each call and renders the interpolated source in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    setConditions('fr');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(t('Hello, {name}!', { name: 'Ann' })).toBe('Hello, Ann!');
      expect(t`Hello, ${'Ann'}!`).toBe('Hello, Ann!');
      expect(error).toHaveBeenCalledTimes(2);
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining('use useGT() in components')
      );
      expect(lookupTranslation).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
      vi.unstubAllEnvs();
    }
  });

  it('renders the quotes and braces of a tagged template as written in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    setConditions('fr');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(t`Hello '${'Ann'}'`).toBe("Hello 'Ann'");
      expect(t`Use {name} for ${'Ann'}`).toBe('Use {name} for Ann');
    } finally {
      error.mockRestore();
      vi.unstubAllEnvs();
    }
  });
});

describe('t in a client-rendered (SPA) app', () => {
  beforeEach(() => {
    resetGTGlobals();
    lookupTranslation.mockReset();
    setup('SPA', 'fr');
  });

  it('translates at module level without reporting', () => {
    vi.stubEnv('NODE_ENV', 'development');
    lookupTranslation.mockReturnValue('Bonjour, {name} !');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      // A module-level constant, evaluated once at import time.
      const greeting = t('Hello, {name}!', { name: 'Ann' });
      expect(greeting).toBe('Bonjour, Ann !');
      expect(error).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
      vi.unstubAllEnvs();
    }
  });
});
