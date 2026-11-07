import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DictionaryProvider } from '@generaltranslation/react-core/compat';

// The root provider imports react-native, which vitest cannot parse.
vi.mock('../../provider/GTProvider', () => ({ GTProvider: vi.fn() }));

const { GTProvider: RootGTProvider } =
  await import('../../provider/GTProvider');
const { GTProvider } = await import('../GTProvider');

describe('compat GTProvider', () => {
  it('renders the root GTProvider around a DictionaryProvider with its own store', () => {
    const dictionaries = { en: { greeting: 'Hello' } };
    const onMissingDictionaryEntry = vi.fn();

    const element = GTProvider({
      locale: 'en',
      dictionaries,
      onMissingDictionaryEntry,
      children: 'content',
    }) as ReactElement<{ children: ReactElement<Record<string, unknown>> }>;

    expect(element.type).toBe(RootGTProvider);
    expect(element.props).toMatchObject({ locale: 'en' });
    const inner = element.props.children;
    expect(inner.type).toBe(DictionaryProvider);
    expect(inner.props).toEqual({
      dictionaries,
      onMissingDictionaryEntry,
      onMissingDictionaryObj: undefined,
      children: 'content',
    });
  });
});
