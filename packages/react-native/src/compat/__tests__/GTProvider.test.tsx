import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DictionaryProvider } from '@generaltranslation/react-core/compat';

// The root provider imports react-native, which vitest cannot parse.
vi.mock('../../provider/GTProvider', () => ({ GTProvider: vi.fn() }));

const { GTProvider: RootGTProvider } =
  await import('../../provider/GTProvider');
const { GTProvider } = await import('../GTProvider');

describe('compat GTProvider', () => {
  it('provides dictionaries to the loading fallback as well as the children', () => {
    const dictionaries = { en: { greeting: 'Hello' } };
    const onMissingDictionaryEntry = vi.fn();

    const element = GTProvider({
      locale: 'en',
      dictionaries,
      onMissingDictionaryEntry,
      fallback: 'fallback',
      children: 'content',
    }) as ReactElement<{ children: ReactElement<Record<string, unknown>> }>;

    // The root provider renders both the fallback and the children, so
    // DictionaryProvider must sit above it.
    expect(element.type).toBe(DictionaryProvider);
    expect(element.props).toMatchObject({
      dictionaries,
      onMissingDictionaryEntry,
      onMissingDictionaryObj: undefined,
    });
    const inner = element.props.children;
    expect(inner.type).toBe(RootGTProvider);
    expect(inner.props).toEqual({
      locale: 'en',
      fallback: 'fallback',
      children: 'content',
    });
  });
});
