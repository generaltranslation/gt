import {
  isMessageTree,
  type MessageTree,
  type MessageFormats,
} from '@generaltranslation/icu';
import {
  hashSource,
  type MessageTreeHashMetadata,
} from 'generaltranslation/id';
import { formatDiagnosticErrorDetails } from 'generaltranslation/diagnostics';
import { formatCutoff } from 'generaltranslation/internal';
import { getI18nCache } from '../i18n-cache/singleton-operations';
import type { I18nConfig } from '../i18n-config/I18nConfig';
import { getI18nConfig } from '../i18n-config/singleton-operations';
import { createGtI18nDiagnostic } from '../logs/diagnostics';
import logger from '../logs/logger';
import type { LookupOptions } from './types/options';

export type MessageTreeMetadata = MessageTreeHashMetadata & {
  /** Precomputed hash (e.g. injected by a compiler); skips hashing. */
  $_hash?: string;
};

/**
 * The lookup options of a message tree, as I18nCache lookups take them, with
 * its locale and hash.
 */
export type MessageTreeLookupOptions = Extract<
  LookupOptions,
  { $format: 'MESSAGE_TREE' }
> & { $locale: string; $_hash: string };

/**
 * Reads a tree's catalog entry like I18nCache.lookupTranslation, with the
 * locale in `options.$locale`; the result is validated before use.
 */
export type LookupTreeTranslation = (
  tree: MessageTree,
  options: MessageTreeLookupOptions
) => unknown;

/** A tree's catalog key: the precomputed `$_hash`, or the hash of the tree. */
export function hashMessageTree(
  tree: MessageTree,
  { context, maxChars, requiresReview, $_hash }: MessageTreeMetadata
): string {
  return (
    $_hash ??
    hashSource({
      source: tree,
      dataFormat: 'MESSAGE_TREE',
      context,
      maxChars,
      requiresReview,
    })
  );
}

/**
 * Renders a source tree in `locale`, using a loaded translated tree when one
 * exists, and the source otherwise.
 */
export function renderMessage(
  tree: MessageTree,
  values: Record<string, unknown>,
  formats: MessageFormats,
  locale: string,
  metadata: MessageTreeMetadata,
  lookupTranslation: LookupTreeTranslation
): string {
  const { maxChars } = metadata;
  const defaultLocale = getI18nConfig().getDefaultLocale();
  const options = createMessageTreeLookupOptions(tree, locale, metadata);
  const hash = options.$_hash;
  const translation = lookupTreeTranslation(
    lookupTranslation(tree, options),
    locale,
    hash
  );

  let outputLocale = defaultLocale;
  let output: string | undefined;
  // An empty translation is the text '', not a missing one.
  if (translation !== undefined) {
    try {
      output = formatTree(translation, locale, values, formats);
      outputLocale = locale;
    } catch (error) {
      warnOnce(
        `format:${locale}:${hash}`,
        createTranslationFormatWarning(locale, hash, error)
      );
    }
  }
  output ??= formatTree(tree, defaultLocale, values, formats);

  return maxChars == null
    ? output
    : formatCutoff(output, {
        locales: getI18nConfig().resolveCanonicalLocale(outputLocale),
        maxChars,
      });
}

/**
 * A call site whose message a compiler built ahead of time: its hash, source
 * tree and literal options, written at the call and passed to the GT with the
 * values in place of the template.
 */
export type PrecomputedMessage = MessageTreeHashMetadata & {
  $_hash: string;
  $_tree: MessageTree;
  /** The formatting context of the tree's variables, when it is static. */
  $_formats?: MessageFormats;
};

const NO_VALUES: Record<string, unknown> = {};
const NO_FORMATS: MessageFormats = {};

export function isPrecomputedMessage(
  value: object
): value is PrecomputedMessage {
  return (value as PrecomputedMessage).$_tree !== undefined;
}

// The config with which the I18nCache was last seen set up.
let configWithCache: I18nConfig | undefined;

function hasCache(config: I18nConfig): boolean {
  if (configWithCache !== config) {
    // Throws for a cache that was never set up, as its lookup does.
    getI18nCache();
    configWithCache = config;
  }
  return true;
}

/**
 * Renders a precomputed message like renderMessage renders its template:
 * the same lookup, validation, formatting, fallback and cutoff.
 */
export function renderPrecomputedMessage(
  site: PrecomputedMessage,
  values: Record<string, unknown> = NO_VALUES,
  formats: MessageFormats = site.$_formats ?? NO_FORMATS,
  locale: string,
  enabled: boolean,
  lookupTranslation: LookupTreeTranslation,
  readsCache: boolean
): string {
  const tree = site.$_tree;
  const hash = site.$_hash;
  const config = getI18nConfig();
  const defaultLocale = config.getDefaultLocale();
  let translation: MessageTree | undefined;
  // Disabled skips every lookup, including custom ones with default-locale entries.
  if (enabled) {
    if (readsCache && locale === defaultLocale && hasCache(config)) {
      // The I18nCache gives a message in the default locale back as its own
      // entry, so there is nothing to look up.
      translation = tree;
    } else {
      const entry = lookupTranslation(
        tree,
        createMessageTreeLookupOptions(tree, locale, site)
      );
      // The compiler built the site's own tree, the default locale's entry.
      translation =
        entry === tree ? tree : lookupTreeTranslation(entry, locale, hash);
    }
  }

  const { maxChars } = site;
  let outputLocale = defaultLocale;
  let output: string | undefined;
  // An empty translation is the text '', not a missing one.
  if (translation !== undefined) {
    try {
      output = formatTree(translation, locale, values, formats);
      outputLocale = locale;
    } catch (error) {
      warnOnce(
        `format:${locale}:${hash}`,
        createTranslationFormatWarning(locale, hash, error)
      );
    }
  }
  output ??= formatTree(tree, defaultLocale, values, formats);
  return maxChars == null
    ? output
    : formatCutoff(output, {
        locales: config.resolveCanonicalLocale(outputLocale),
        maxChars,
      });
}

/** The lookup options of a tree in `locale`, hashing it unless `$_hash` is set. */
export function createMessageTreeLookupOptions(
  tree: MessageTree,
  locale: string,
  metadata: MessageTreeMetadata
): MessageTreeLookupOptions {
  const { context, maxChars, requiresReview } = metadata;
  return {
    $format: 'MESSAGE_TREE',
    $locale: locale,
    $context: context,
    $maxChars: maxChars,
    $requiresReview: requiresReview,
    $_hash: hashMessageTree(tree, metadata),
  };
}

function createTranslationFormatWarning(
  locale: string,
  hash: string,
  error: unknown
): string {
  return createGtI18nDiagnostic({
    severity: 'Warning',
    whatHappened: `Formatting the "${locale}" translation of message ${hash} failed`,
    reassurance: 'The source message was rendered instead',
    details: formatDiagnosticErrorDetails(error),
  });
}

function createInvalidTreeTranslationWarning(
  locale: string,
  hash: string
): string {
  return createGtI18nDiagnostic({
    severity: 'Warning',
    whatHappened: `The "${locale}" translation of message ${hash} is not a message tree`,
    reassurance: 'The source message was rendered instead',
    fix: 'Regenerate the translations for this locale',
  });
}

// Trees that passed validation. A catalog keeps the same object for an entry
// until it is replaced, so each is validated once.
const validTrees = new WeakSet<object>();

function lookupTreeTranslation(
  value: unknown,
  locale: string,
  hash: string
): MessageTree | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && validTrees.has(value)) {
    return value as MessageTree;
  }
  if (isMessageTree(value)) {
    validTrees.add(value as object);
    return value;
  }
  warnOnce(
    `invalid:${locale}:${hash}`,
    createInvalidTreeTranslationWarning(locale, hash)
  );
  return undefined;
}

function formatTree(
  tree: MessageTree,
  locale: string,
  values: Record<string, unknown>,
  formats: MessageFormats
): string {
  // Text needs no formatting.
  if (typeof tree === 'string') return tree;
  // The config resolves custom aliases, which must not reach Intl as
  // language codes, and formats in its time zone.
  const formatted = getI18nConfig().formatMessageTree(tree, {
    locale,
    values,
    formats,
  });
  return Array.isArray(formatted) ? formatted.join('') : String(formatted);
}

const warned = new Set<string>();
// Keys are per message and locale; the cap bounds memory in long-lived servers.
const MAX_WARNED_KEYS = 1000;

function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  if (warned.size >= MAX_WARNED_KEYS) warned.clear();
  warned.add(key);
  logger.warn(message);
}
