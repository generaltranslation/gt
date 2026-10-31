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
import { getTranslationParser } from './translationParser';

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

/**
 * Renders a source tree in `locale`, using a loaded translated tree when one
 * exists, and the source otherwise.
 */
export function renderMessage(
  tree: MessageTree,
  values: Record<string, unknown>,
  locale: string,
  { context, maxChars, requiresReview, $_hash }: MessageTreeMetadata,
  lookupTranslation: LookupTreeTranslation
): string {
  const defaultLocale = getI18nConfig().getDefaultLocale();
  // Hashed here, without gt-i18n's hashMessage, which loads the ICU parser.
  const hash =
    $_hash ??
    hashSource({
      source: tree,
      dataFormat: 'ICU_TREE',
      context,
      maxChars,
      requiresReview,
    });
  const options: MessageTreeLookupOptions = {
    $format: 'ICU_TREE',
    $locale: locale,
    $context: context,
    $maxChars: maxChars,
    $requiresReview: requiresReview,
    $_hash: hash,
  };
  const translation = lookupTreeTranslation(
    lookupTranslation(tree, options),
    tree,
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
    wayOut:
      'If your translations are ICU strings, import the /unstable/icu entry of your GT package once, such as gt-react/unstable/icu',
  });
}

function createIcuTranslationWarning(
  locale: string,
  hash: string,
  error: unknown
): string {
  return createGtI18nDiagnostic({
    severity: 'Warning',
    whatHappened: `The "${locale}" ICU translation of message ${hash} could not be used`,
    reassurance: 'The source message was rendered instead',
    details: formatDiagnosticErrorDetails(error),
  });
}

function lookupTreeTranslation(
  value: unknown,
  source: MessageTree,
  locale: string,
  hash: string
): MessageTree | undefined {
  if (value == null || isMessageTree(value)) return value ?? undefined;
  const parseTranslation = getTranslationParser();
  if (typeof value === 'string' && parseTranslation) {
    try {
      return parseTranslation(value, source, hash);
    } catch (error) {
      warnOnce(
        `icu:${locale}:${hash}`,
        createIcuTranslationWarning(locale, hash, error)
      );
      return undefined;
    }
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
