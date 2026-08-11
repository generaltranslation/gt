import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TranslationPreferences } from '../../adapter/types';
import {
  getPreferencesStorageKey,
  readPreferences,
  writePreferences,
} from '../translationPreferences';

const defaults: TranslationPreferences = {
  autoRefresh: true,
  autoImport: true,
  autoPatchReferences: false,
  autoPublish: false,
  preserveExistingTranslations: false,
};

const KEY = getPreferencesStorageKey('proj', 'production');

describe('getPreferencesStorageKey', () => {
  it('separates Studios sharing an origin', () => {
    expect(getPreferencesStorageKey('a', 'production')).not.toBe(
      getPreferencesStorageKey('b', 'production')
    );
    expect(getPreferencesStorageKey('a', 'production')).not.toBe(
      getPreferencesStorageKey('a', 'staging')
    );
  });

  it('tolerates a client with no project or dataset', () => {
    expect(getPreferencesStorageKey(undefined, undefined)).toBe(
      'gt-sanity:preferences::'
    );
  });
});

describe('readPreferences', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('falls back to the plugin defaults when nothing is stored', () => {
    expect(readPreferences(KEY, defaults)).toEqual(defaults);
  });

  it('prefers a stored choice over the plugin default', () => {
    // The point of the feature: the user turned publishing on, and it survives
    // a reload instead of snapping back to the config default.
    writePreferences(KEY, { ...defaults, autoPublish: true });
    expect(readPreferences(KEY, defaults).autoPublish).toBe(true);
  });

  it('keeps an opt-out of a preference that defaults on', () => {
    writePreferences(KEY, { ...defaults, autoImport: false });
    expect(readPreferences(KEY, defaults).autoImport).toBe(false);
  });

  it('persists the save-local-edits choice alongside the automatic actions', () => {
    writePreferences(KEY, { ...defaults, preserveExistingTranslations: true });
    expect(readPreferences(KEY, defaults).preserveExistingTranslations).toBe(
      true
    );
  });

  it('fills in preferences missing from an older stored object', () => {
    window.localStorage.setItem(KEY, JSON.stringify({ autoPublish: true }));
    expect(readPreferences(KEY, defaults)).toEqual({
      ...defaults,
      autoPublish: true,
    });
  });

  it('ignores non-boolean stored values', () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ autoPublish: 'yes', autoImport: null })
    );
    expect(readPreferences(KEY, defaults)).toEqual(defaults);
  });

  it('falls back on malformed or non-object JSON', () => {
    window.localStorage.setItem(KEY, 'not json');
    expect(readPreferences(KEY, defaults)).toEqual(defaults);

    window.localStorage.setItem(KEY, JSON.stringify(['autoPublish']));
    expect(readPreferences(KEY, defaults)).toEqual(defaults);
  });

  it('falls back when localStorage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('SecurityError');
      },
    });
    expect(readPreferences(KEY, defaults)).toEqual(defaults);
    // Writing must stay non-fatal — the choice just doesn't outlive the tab.
    expect(() => writePreferences(KEY, defaults)).not.toThrow();
  });
});
