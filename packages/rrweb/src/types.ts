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

/** 16:9 as a numeric ratio — the default capture aspect. */
export const ASPECT_16_9 = 16 / 9;

/** Resolve a FrameOption to a numeric aspect ratio, or null for 'none'. */
export function aspectOf(frame: FrameOption | undefined): number | null {
  if (frame === '16:9') return ASPECT_16_9;
  if (frame && typeof frame === 'object' && frame.aspect > 0)
    return frame.aspect;
  return null;
}

/**
 * How to fetch a locale's translations for `key: 'hash'` harvest. Mirrors GT's own
 * `TranslationsLoader`; the default resolves through the app's configured loader so
 * a custom `loadTranslations` (or the CDN) is honored without hardcoding a source.
 */
export type TranslationsLoader = (locale: string) => Promise<unknown>;

export type HarvestOptions = {
  /**
   * Turn (path, source, target) into the URL to render for the structural harvest.
   * The default assumes LOCALE-PREFIXED routing — it swaps the source-locale path
   * segment (wherever it appears) for the target, or prepends one. An app is NOT
   * guaranteed to encode the locale in the path at all (cookie/domain/query
   * strategies), so those apps MUST pass this.
   */
  localeToUrl?: (path: string, source: string, target: string) => string;
  /**
   * The locale the recording was captured in (the source render). Defaults to the
   * GT locale cookie (`localeCookieName`), then `locales[0]`. Set this when the app
   * doesn't rely on the GT cookie.
   */
  sourceLocale?: string;
  /**
   * Name of the cookie the GT library stores the active locale in. When set, it's
   * read to detect the source locale (instead of falling back to `locales[0]`). Pass
   * GT's `defaultLocaleCookieName` (from `@generaltranslation/react-core`) or a custom
   * name; omitted by default so gt-rrweb doesn't hardcode a framework's cookie.
   */
  localeCookieName?: string;
  /**
   * 'auto' (default): hash if the recording carries `data-_gt-hash`, else structural.
   * 'structural': pair source↔target text by DOM structure (renders each locale).
   * 'hash': map recorded node hashes to a translations dict (needs `_tagIds`).
   */
  key?: 'auto' | 'structural' | 'hash';
  /** Translation source for `key: 'hash'` (see TranslationsLoader). */
  getTranslations?: TranslationsLoader;
  /**
   * CSS selector for the region to harvest within. Defaults to the recorder's own
   * content selector (what was recorded/framed) so the harvest covers the SAME region
   * — including a sidebar — not just `<main>`.
   */
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
