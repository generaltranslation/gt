import { describe, expect, it } from 'vitest';
import type { TranslationStatus } from '../../adapter/types';
import { resolveLanguageStatusState } from '../languageStatusState';

const ready = { progress: 100, isReady: true } as TranslationStatus;
const notReady = { progress: 0, isReady: false } as TranslationStatus;

describe('resolveLanguageStatusState', () => {
  it('distinguishes a translation in progress from one never requested', () => {
    // Both report 0% from the API; only the pending set tells them apart.
    expect(
      resolveLanguageStatusState({
        status: notReady,
        isImported: false,
        isPending: true,
      })
    ).toBe('translating');
    expect(
      resolveLanguageStatusState({
        status: notReady,
        isImported: false,
        isPending: false,
      })
    ).toBe('not-translated');
  });

  it('offers a ready translation for import', () => {
    expect(
      resolveLanguageStatusState({
        status: ready,
        isImported: false,
        isPending: false,
      })
    ).toBe('ready');
  });

  it('keeps showing imported after the status query stops returning the file', () => {
    // A downloaded file is excluded from later status queries, so it comes back
    // as not ready. The row must not fall back to "not translated".
    expect(
      resolveLanguageStatusState({
        status: notReady,
        isImported: true,
        isPending: false,
      })
    ).toBe('imported');
    expect(
      resolveLanguageStatusState({ isImported: true, isPending: false })
    ).toBe('imported');
  });

  it('treats imported as final even while still marked pending', () => {
    expect(
      resolveLanguageStatusState({
        status: ready,
        isImported: true,
        isPending: true,
      })
    ).toBe('imported');
  });
});
