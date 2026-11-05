import {
  formatMessageTree,
  isMessageTree,
  type MessageTree,
} from '@generaltranslation/icu';
import { formatCutoff } from '@generaltranslation/format';
import {
  hashSource,
  type MessageTreeHashMetadata,
} from 'generaltranslation/id';
import { formatDiagnosticErrorDetails } from 'generaltranslation/internal';
import { getI18nConfig } from '../i18n-config/singleton-operations';
import { createGtI18nDiagnostic } from '../logs/diagnostics';
import logger from '../logs/logger';
import type { LookupOptions } from '../translation-functions/types/options';

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
  { $format: 'ICU_TREE' }
> & { $locale: string; $_hash: string };

/**
 * Reads a tree's catalog entry like I18nCache.lookupTranslation, with the
 * locale in `options.$locale`; the result is validated before use.
 */
export type LookupTreeTranslation = (
  message: MessageTree,
  options: MessageTreeLookupOptions
) => unknown;

/** A tree's catalog key: the precomputed `$_hash`, or the hash of the tree. */
export function hashMessageTree(
  tree: MessageTree,
  { context, maxChars, requiresReview, $_hash }: MessageTreeMetadata
): string {
  // Hashed here, without gt-i18n's hashMessage, which loads the ICU parser.
  return (
    $_hash ??
    hashSource({
      source: tree,
      dataFormat: 'ICU_TREE',
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
  if (translation) {
    try {
      output = formatTree(translation, locale, values);
      outputLocale = locale;
    } catch (error) {
      warnOnce(
        `format:${locale}:${hash}`,
        createTranslationFormatWarning(locale, hash, error)
      );
    }
  }
  output ??= formatTree(tree, defaultLocale, values);

  return maxChars == null
    ? output
    : formatCutoff(output, {
        locales: getI18nConfig().resolveCanonicalLocale(outputLocale),
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
    $format: 'ICU_TREE',
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

function lookupTreeTranslation(
  value: unknown,
  locale: string,
  hash: string
): MessageTree | undefined {
  if (value == null || isMessageTree(value)) return value ?? undefined;
  warnOnce(
    `invalid:${locale}:${hash}`,
    createInvalidTreeTranslationWarning(locale, hash)
  );
  return undefined;
}

function formatTree(
  tree: MessageTree,
  locale: string,
  values: Record<string, unknown>
): string {
  const config = getI18nConfig();
  // Custom aliases must not reach Intl as language codes.
  const locales = [locale, config.getDefaultLocale()].map((code) =>
    config.resolveCanonicalLocale(code)
  );
  const formatted = formatMessageTree(tree, locales, values);
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
