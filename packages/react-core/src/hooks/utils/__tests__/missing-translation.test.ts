import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactI18nLookup } from '../../../i18n-cache/ReactI18nCache';

const context = vi.hoisted(() => ({
  current: undefined as
    | {
        onMissingTranslation?: (lookup: unknown) => void;
        onMissingDictionaryEntry?: (lookup: unknown) => void;
        onMissingDictionaryObj?: (lookup: unknown) => void;
        resolveMissingDuringRender: boolean;
      }
    | undefined,
}));
const effects = vi.hoisted(() => [] as Array<() => void>);
const resolveMissing = vi.hoisted(() => vi.fn());

vi.mock('react', () => ({
  useEffect: (effect: () => void) => effects.push(effect),
}));
vi.mock('../../../context/context', () => ({
  useGTContext: () => context.current,
}));
vi.mock('../../../i18n-cache/singleton-operations', () => ({
  getReactI18nCache: () => ({ resolveMissing }),
}));
vi.mock('../../utils', () => ({ useShouldTranslate: () => true }));
vi.mock('gt-i18n/internal', async (importOriginal) => ({
  ...(await importOriginal<typeof import('gt-i18n/internal')>()),
  getI18nConfig: () => ({ isDevHotReloadEnabled: () => true }),
}));

describe('missing translation compatibility callbacks', () => {
  beforeEach(() => {
    context.current = undefined;
    effects.length = 0;
    resolveMissing.mockReset();
  });

  it('prefers the translation override and passes the legacy lookup shape', async () => {
    const onMissingTranslation = vi.fn();
    context.current = {
      onMissingTranslation,
      resolveMissingDuringRender: true,
    };
    const { useHandleMissingTranslation } =
      await import('../missing-translation');
    const handleMissing = useHandleMissingTranslation();

    handleMissing({
      locale: 'fr',
      message: 'Hello',
      options: { $format: 'ICU' },
    });

    expect(onMissingTranslation).toHaveBeenCalledWith({
      locale: 'fr',
      message: 'Hello',
      options: { $format: 'ICU' },
    });
    expect(resolveMissing).not.toHaveBeenCalled();
  });

  it('keeps entry and object overrides distinct', async () => {
    const onMissingDictionaryEntry = vi.fn();
    const onMissingDictionaryObj = vi.fn();
    context.current = {
      onMissingDictionaryEntry,
      onMissingDictionaryObj,
      resolveMissingDuringRender: true,
    };
    const { useHandleMissingDictionary } =
      await import('../missing-translation');
    const handlers = useHandleMissingDictionary();
    const lookup = { locale: 'fr', id: 'nav' };

    handlers.dictionaryEntry(lookup);
    handlers.dictionaryObject(lookup);

    expect(onMissingDictionaryEntry).toHaveBeenCalledWith(lookup);
    expect(onMissingDictionaryObj).toHaveBeenCalledWith(lookup);
    expect(resolveMissing).not.toHaveBeenCalled();
  });

  it('queues distinct entry and object requests without overrides', async () => {
    const { useHandleMissingDictionary } =
      await import('../missing-translation');
    const handlers = useHandleMissingDictionary();
    const lookup = { locale: 'fr', id: 'nav' };

    handlers.dictionaryEntry(lookup);
    handlers.dictionaryObject(lookup);
    effects.forEach((effect) => effect());

    const expected: ReactI18nLookup[] = [
      { type: 'dictionaryEntry', ...lookup },
      { type: 'dictionaryObject', ...lookup },
    ];
    expect(resolveMissing.mock.calls.map(([request]) => request)).toEqual(
      expected
    );
  });
});
