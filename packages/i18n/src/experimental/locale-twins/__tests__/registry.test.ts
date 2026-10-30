import { encodeLocaleTwinPlaceholder } from 'generaltranslation/internal/experimental';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getLocaleTwinEntry,
  getLocaleTwinLocale,
  hasLocaleTwins,
  registerLocaleTwin,
} from '../registry';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: Record<string, unknown>;
};

const HASH_A = '0123456789abcdef';
const HASH_B = 'fedcba9876543210';

/** The runtime value of a filled placeholder: `JSON.stringify(table)`. */
function filled(locale: string, entries: Record<string, unknown>): string {
  return JSON.stringify({ l: locale, e: entries });
}

function resetRegistry() {
  const globalObj = globalThis as TestGlobal;
  if (globalObj.__generaltranslation) {
    Reflect.deleteProperty(globalObj.__generaltranslation, 'localeTwins');
  }
}

describe('locale twin registry', () => {
  beforeEach(() => {
    resetRegistry();
  });

  it('resolves registered entries by hash and records the twin locale', () => {
    expect(registerLocaleTwin(filled('fr', { [HASH_A]: 'Bonjour' }))).toBe(
      true
    );

    expect(getLocaleTwinEntry(HASH_A)).toBe('Bonjour');
    expect(getLocaleTwinLocale()).toBe('fr');
    expect(hasLocaleTwins()).toBe(true);
  });

  it('ignores an unfilled placeholder (server bundles and original chunks)', () => {
    const placeholder = encodeLocaleTwinPlaceholder({ [HASH_A]: 'Hello' });

    expect(registerLocaleTwin(placeholder)).toBe(false);

    expect(hasLocaleTwins()).toBe(false);
    expect(getLocaleTwinEntry(HASH_A)).toBeUndefined();
    expect(getLocaleTwinLocale()).toBeUndefined();
  });

  it('works before any GT global state or initialization exists', () => {
    const globalObj = globalThis as TestGlobal;
    const previous = globalObj.__generaltranslation;
    Reflect.deleteProperty(globalObj, '__generaltranslation');
    try {
      expect(hasLocaleTwins()).toBe(false);
      expect(registerLocaleTwin(filled('ja', { [HASH_A]: 'こんにちは' }))).toBe(
        true
      );
      expect(getLocaleTwinEntry(HASH_A)).toBe('こんにちは');
    } finally {
      globalObj.__generaltranslation = previous;
    }
  });

  it('keeps registered content by reference and sees later registrations', () => {
    const jsx = { t: 'b', c: 'Salut', i: 1 };
    registerLocaleTwin(filled('fr', { [HASH_A]: jsx }));
    const first = getLocaleTwinEntry(HASH_A);

    expect(first).toEqual(jsx);
    expect(getLocaleTwinEntry(HASH_A)).toBe(first);
    expect(getLocaleTwinEntry(HASH_B)).toBeUndefined();

    // A lazily loaded chunk registers after the first lookups.
    registerLocaleTwin(filled('fr', { [HASH_B]: 'Au revoir' }));

    expect(getLocaleTwinEntry(HASH_B)).toBe('Au revoir');
    expect(getLocaleTwinEntry(HASH_A)).toBe(first);
  });

  it('reports a malformed value without throwing during chunk evaluation', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    try {
      expect(registerLocaleTwin('{"not":"a table"}')).toBe(false);

      expect(hasLocaleTwins()).toBe(false);
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(consoleError.mock.calls[0][0]).toMatch(
        /^gt-i18n Error: A locale twin could not be registered/
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it('exposes the compiler-injected registration and readers from gt-i18n/internal', async () => {
    const internal = await import('../../internal');

    expect(
      internal.GtInternalRegisterLocaleTwin(filled('zh', { [HASH_A]: '你好' }))
    ).toBe(true);

    expect(internal.hasLocaleTwins()).toBe(true);
    expect(internal.getLocaleTwinLocale()).toBe('zh');
    expect(internal.getLocaleTwinEntry(HASH_A)).toBe('你好');
  });

  it('shares one registry across duplicated bundled copies via globalThis', async () => {
    vi.resetModules();
    const copyA = await import('../registry');
    vi.resetModules();
    const copyB = await import('../registry');
    expect(copyA.registerLocaleTwin).not.toBe(copyB.registerLocaleTwin);

    copyA.registerLocaleTwin(filled('es', { [HASH_A]: 'Hola' }));

    expect(copyB.hasLocaleTwins()).toBe(true);
    expect(copyB.getLocaleTwinLocale()).toBe('es');
    expect(copyB.getLocaleTwinEntry(HASH_A)).toBe('Hola');
  });
});
