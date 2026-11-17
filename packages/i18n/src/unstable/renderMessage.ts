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
import type { I18nConfig } from '../i18n-config/I18nConfig';
import { getI18nConfig } from '../i18n-config/singleton-operations';
import { createGtI18nDiagnostic } from '../logs/diagnostics';
import logger from '../logs/logger';
import { lookupInlineTranslation } from '../translation-functions/inline/inlineTranslations';
import type { LookupOptions } from '../translation-functions/types/options';
import type { InlineTranslationsOption } from '../types-dir/inline';

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
  // Hashed here, without gt-i18n's hashContent, which loads the ICU parser.
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
 * tree and literal options. The compiler hoists one per call site to module
 * scope and passes it to the GT with the values, in place of the template.
 */
export type PrecomputedMessage = MessageTreeHashMetadata &
  InlineTranslationsOption<MessageTree> & {
    $_hash: string;
    $_tree: MessageTree;
    /** The formatting context of the tree's variables, when it is static. */
    $_formats?: MessageFormats;
    /**
     * Set when a per-locale build replaced the source: the locale `$_tree` is
     * the translation for.
     */
    $_locale?: string;
    /** What the call site last rendered; set as it renders. */
    $_resolved?: ResolvedMessage;
  };

/**
 * What a precomputed message resolved to, kept while the config, the
 * conditions and the looked-up catalog entry stay the same objects.
 */
type ResolvedMessage = {
  config: I18nConfig;
  locale: string;
  enabled: boolean;
  options: MessageTreeLookupOptions;
  /** The translation embedded at the call site for the locale. */
  embedded: MessageTree | undefined;
  /** The catalog entry or embedded translation last read. */
  entry: unknown;
  /** That entry once validated. */
  translation: MessageTree | undefined;
  /** The output, when it is text that no value changes. */
  text: string | undefined;
};

const NO_VALUES: Record<string, unknown> = {};
const NO_FORMATS: MessageFormats = {};
// No catalog holds this object, so the first lookup always differs from it.
const NOT_READ = {};

export function isPrecomputedMessage(
  value: object
): value is PrecomputedMessage {
  return (value as PrecomputedMessage).$_tree !== undefined;
}

/**
 * Renders a precomputed message like renderMessage renders its template:
 * the same lookup, validation, formatting, fallback and cutoff. The lookup
 * still runs on every call, so a replaced catalog entry is seen at once.
 */
export function renderPrecomputedMessage(
  site: PrecomputedMessage,
  values: Record<string, unknown> = NO_VALUES,
  formats: MessageFormats = site.$_formats ?? NO_FORMATS,
  locale: string,
  enabled: boolean,
  lookupTranslation: LookupTreeTranslation
): string {
  const config = getI18nConfig();
  const tree = site.$_tree;
  let resolved = site.$_resolved;
  if (
    resolved === undefined ||
    resolved.locale !== locale ||
    resolved.enabled !== enabled ||
    resolved.config !== config
  ) {
    resolved = site.$_resolved = {
      config,
      locale,
      enabled,
      options: createMessageTreeLookupOptions(tree, locale, site),
      embedded: enabled ? lookupEmbeddedTranslation(site, locale) : undefined,
      entry: NOT_READ,
      translation: undefined,
      text: undefined,
    };
  }
  // Disabled skips every lookup, including custom ones with default-locale entries.
  const entry = enabled
    ? (resolved.embedded ?? lookupTranslation(tree, resolved.options))
    : undefined;
  if (entry !== resolved.entry) {
    resolved.entry = entry;
    // The compiler built the site's own tree, which is the entry of a
    // replaced site and of the default locale.
    resolved.translation =
      entry === tree ? tree : lookupTreeTranslation(entry, locale, site.$_hash);
    resolved.text = undefined;
  }
  if (resolved.text !== undefined) return resolved.text;

  const { translation } = resolved;
  const { maxChars } = site;
  const defaultLocale = config.getDefaultLocale();
  let outputLocale = defaultLocale;
  let rendered = tree;
  let output: string | undefined;
  // An empty translation is the text '', not a missing one.
  if (translation !== undefined) {
    try {
      output = formatTree(translation, locale, values, formats);
      outputLocale = locale;
      rendered = translation;
    } catch (error) {
      warnOnce(
        `format:${locale}:${site.$_hash}`,
        createTranslationFormatWarning(locale, site.$_hash, error)
      );
    }
  }
  output ??= formatTree(tree, defaultLocale, values, formats);
  if (maxChars != null) {
    output = formatCutoff(output, {
      locales: config.resolveCanonicalLocale(outputLocale),
      maxChars,
    });
  }
  if (typeof rendered === 'string') resolved.text = output;
  return output;
}

/** The translation the compiler embedded at the site for `locale`. */
function lookupEmbeddedTranslation(
  site: PrecomputedMessage,
  locale: string
): MessageTree | undefined {
  const { $_locale, $_tree, inline } = site;
  if ($_locale === undefined) {
    return inline && lookupInlineTranslation(inline, locale);
  }
  return lookupInlineTranslation(
    (embedded) => (embedded === $_locale ? $_tree : inline?.(embedded)),
    locale
  );
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

// Configured locales that Intl accepted, by the config that holds them.
let acceptedLocales: { config: I18nConfig; locales: Set<string> } | undefined;

function formatTree(
  tree: MessageTree,
  locale: string,
  values: Record<string, unknown>,
  formats: MessageFormats
): string {
  const config = getI18nConfig();
  if (acceptedLocales?.config !== config) {
    acceptedLocales = { config, locales: new Set() };
  }
  // Text needs no formatting, only a locale that formatting would accept.
  if (typeof tree === 'string' && acceptedLocales.locales.has(locale)) {
    return tree;
  }
  // The config resolves custom aliases, which must not reach Intl as
  // language codes, and formats in its time zone.
  const formatted = config.formatMessageTree(tree, {
    locales: [locale, config.getDefaultLocale()],
    values,
    formats,
  });
  if (locale === config.getDefaultLocale() || config.locales.includes(locale)) {
    acceptedLocales.locales.add(locale);
  }
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
