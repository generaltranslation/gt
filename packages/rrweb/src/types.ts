import type { eventWithTime } from '@rrweb/types';

/** Per-locale text overlay: locale → (rrweb node id → translated text). */
export type LocaleTextOverlay = Record<string, Record<number, string>>;

/** Passed to `start()` — the locales this recording traces, SOURCE FIRST. */
export type RecorderConfig = {
  locales: string[];
};

/** The finished recording: the rrweb stream + the harvested per-locale overlay. */
export type RecorderBundle = {
  events: eventWithTime[];
  locales: string[];
  overlay: LocaleTextOverlay;
};

/** 'idle' → 'recording' → 'preparing' (harvest running after stop) → 'idle'. */
export type RecorderStatus = 'idle' | 'recording' | 'preparing';

/**
 * Capture framing. While recording, the content region is reflowed into a centered
 * box of this aspect so the replay looks the same on any monitor. 'none' records
 * the region at its natural size.
 */
export type FrameOption = 'none' | '16:9' | { aspect: number };

/**
 * How to fetch a locale's translations for `key: 'hash'` harvest. Mirrors GT's own
 * `TranslationsLoader`; the default resolves through the app's configured loader so
 * a custom `loadTranslations` (or the CDN) is honored without hardcoding a source.
 */
export type TranslationsLoader = (locale: string) => Promise<unknown>;

export type HarvestOptions = {
  /**
   * Turn (path, source, target) into the URL to render for the structural harvest.
   * Default swaps the leading locale path segment (GT path routing). Override for
   * cookie/query locale strategies.
   */
  localeToUrl?: (path: string, source: string, target: string) => string;
  /**
   * 'auto' (default): hash if the recording carries `data-_gt-hash`, else structural.
   * 'structural': pair source↔target text by DOM structure (renders each locale).
   * 'hash': map recorded node hashes to a translations dict (needs `_tagIds`).
   */
  key?: 'auto' | 'structural' | 'hash';
  /** Translation source for `key: 'hash'` (see TranslationsLoader). */
  getTranslations?: TranslationsLoader;
  /** CSS selector for the content region to harvest within. */
  contentSelector?: string;
  /** Upper bound on distinct paths rendered (structural harvest cost guard). */
  maxPaths?: number;
};

/**
 * Custom rrweb event tags the recorder emits — the bundle's wire format.
 * `nav` marks SPA navigations, `locales` records the traced locale set, `i18n`
 * carries the harvested overlay (spliced in after the FullSnapshot).
 */
export const GT_EVENT = {
  nav: 'gt-nav',
  locales: 'gt-locales',
  i18n: 'gt-i18n',
} as const;

/** Default content-region selector: the <main> landmark, or an explicit marker. */
export const DEFAULT_CONTENT_SELECTOR = 'main, [data-gt-content]';
