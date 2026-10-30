import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DictionaryProvider } from '@generaltranslation/react-core/compat';
import { GTDictionaryProvider } from '../GTDictionaryProvider';

describe('GTDictionaryProvider', () => {
  it('renders the shared DictionaryProvider with its own store', () => {
    const dictionaries = { en: { greeting: 'Hello' } };
    const onMissingDictionaryEntry = vi.fn();

    const element = GTDictionaryProvider({
      dictionaries,
      onMissingDictionaryEntry,
      children: 'content',
    }) as ReactElement<Record<string, unknown>>;

    expect(element.type).toBe(DictionaryProvider);
    expect(element.props).toEqual({
      dictionaries,
      onMissingDictionaryEntry,
      children: 'content',
    });
  });
});
