import {
  formatMessageTree,
  isMessageTree,
  type MessageTree,
} from '@generaltranslation/icu';
import { formatCutoff } from '@generaltranslation/format';
import {
  hashMessageTree,
  type MessageTreeHashMetadata,
} from 'generaltranslation/id';
import { formatDiagnosticErrorDetails } from 'generaltranslation/internal';
import { getI18nCache } from '../i18n-cache/singleton-operations';
import { getI18nConfig } from '../i18n-config/singleton-operations';
import { createGtI18nDiagnostic } from '../logs/diagnostics';
import logger from '../logs/logger';

export type MessageTreeMetadata = MessageTreeHashMetadata & {
  /** Precomputed hash (e.g. injected by a compiler); skips hashing. */
  $_hash?: string;
};

/** Reads a raw catalog entry by hash; the result is validated before use. */
type LookupTranslationByHash = (locale: string, hash: string) => unknown;

/** The single place a message tree's catalog key is computed. */
export function hashMessage(
  tree: MessageTree,
  { context, maxChars, requiresReview, $_hash }: MessageTreeMetadata
): string {
  return $_hash ?? hashMessageTree(tree, { context, maxChars, requiresReview });
}

/**
 * Renders a source tree in `locale`, using a loaded translated tree when one
 * exists. Misses render the source: trees are not sent for runtime
 * translation because the translation API does not accept message trees yet.
 */
export function renderMessage(
  tree: MessageTree,
  values: Record<string, unknown>,
  locale: string,
  metadata: MessageTreeMetadata,
  lookupTranslationByHash: LookupTranslationByHash = (requested, hash) =>
    getI18nCache().lookupTranslationByHash(requested, hash)
): string {
  const defaultLocale = getI18nConfig().getDefaultLocale();
  const hash = hashMessage(tree, metadata);
  const translation = lookupTreeTranslation(
    lookupTranslationByHash(locale, hash),
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

  return metadata.maxChars == null
    ? output
    : formatCutoff(output, {
        locales: getI18nConfig().resolveCanonicalLocale(outputLocale),
        maxChars: metadata.maxChars,
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
