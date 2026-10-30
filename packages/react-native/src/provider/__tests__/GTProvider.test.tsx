import { isValidElement, type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DictionaryProvider } from '@generaltranslation/react-core/components';

// react-native's entrypoint uses Flow syntax vitest cannot parse.
vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  TurboModuleRegistry: { getEnforcing: vi.fn(), get: vi.fn() },
  ActivityIndicator: 'ActivityIndicator',
  StyleSheet: { create: (styles: unknown) => styles },
  View: 'View',
}));

describe('GTProvider', () => {
  it('provides dictionaries to the loading fallback as well as the children', async () => {
    const { GTProvider } = await import('../GTProvider');
    const dictionaries = { en: { loading: 'Loading…' } };
    const onMissingDictionaryEntry = vi.fn();
    const fallback = 'fallback';

    const element = GTProvider({
      dictionaries,
      onMissingDictionaryEntry,
      fallback,
      children: 'content',
    }) as ReactElement<{
      dictionaries: unknown;
      onMissingDictionaryEntry: unknown;
      children: ReactElement<{ fallback: unknown; children: unknown }>;
    }>;

    // The loadable provider renders both the fallback and the children, so
    // DictionaryProvider must sit above it.
    expect(element.type).toBe(DictionaryProvider);
    expect(element.props.dictionaries).toBe(dictionaries);
    expect(element.props.onMissingDictionaryEntry).toBe(
      onMissingDictionaryEntry
    );
    expect(isValidElement(element.props.children)).toBe(true);
    expect(element.props.children.props.fallback).toBe(fallback);
    expect(element.props.children.props.children).toBe('content');
    expect(element.props.children.props).not.toHaveProperty('dictionaries');
  });
});
