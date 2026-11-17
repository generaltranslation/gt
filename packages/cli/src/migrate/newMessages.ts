import type { NewMessage } from './migrateCatalogs.js';
import { isRecord } from './catalogs.js';
import type { LegacyDataFormat } from './types.js';

function optionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? Math.abs(number) : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

/** `$` props written as expressions, like `$context={"Nav"}`, are extracted as their source code. */
function propValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/** Reads the messages `gt translate` would upload from the template file's content and format metadata. */
export function readNewMessages(
  content: Record<string, unknown>,
  formatMetadata: Record<string, unknown>
): NewMessage[] {
  return Object.entries(content).map(([hash, source]) => {
    const metadata = isRecord(formatMetadata[hash]) ? formatMetadata[hash] : {};
    const requiresReview =
      metadata.requires_review === true || metadata.requiresReview === true;
    const legacyContext = optionalString(propValue(metadata.$context));
    const legacyMaxChars = optionalNumber(propValue(metadata.$maxChars));
    const legacyRequiresReview = propValue(metadata.$requiresReview) === true;
    const hasLegacyProps =
      legacyContext !== undefined ||
      legacyMaxChars !== undefined ||
      legacyRequiresReview;
    return {
      hash,
      dataFormat: (metadata.dataFormat as LegacyDataFormat) ?? 'JSX',
      source,
      ...(optionalString(metadata.context) && {
        context: optionalString(metadata.context),
      }),
      ...(optionalNumber(metadata.maxChars) !== undefined && {
        maxChars: optionalNumber(metadata.maxChars),
      }),
      ...(requiresReview && { requiresReview }),
      ...(optionalString(metadata.staticId) && {
        staticId: optionalString(metadata.staticId),
      }),
      ...(hasLegacyProps && {
        legacyProps: {
          context: legacyContext,
          maxChars: legacyMaxChars,
          ...(legacyRequiresReview && { requiresReview: true }),
        },
      }),
    };
  });
}
