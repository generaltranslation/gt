// Fitting translated plain text into field character limits.
import { formatCutoff } from 'generaltranslation';
import type { LengthLimit } from './content/fields';
import type { GtClient } from './types';

export type OverLimit = {
  key: string;
  source: string;
  translation: string;
  limit: LengthLimit;
};

// The locale's cutoff ending, such as "…", taken from formatCutoff.
function cutoffEnding(locale: string): string {
  return formatCutoff('xxxxxxxxxx', { locales: locale, maxChars: 5 }).replace(
    /^x+/,
    ''
  );
}

// Cuts text after the last whole word that fits maxChars with the locale's
// cutoff ending.
function cutToLength(text: string, maxChars: number, locale: string): string {
  if (text.length <= maxChars) return text;
  const ending = cutoffEnding(locale);
  const keep = Math.max(0, maxChars - ending.length);
  let cut = text.slice(0, keep);
  const lastSpace = cut.search(/\s\S*$/);
  if (!/\s/.test(text[keep] ?? '') && lastSpace > keep / 2)
    cut = cut.slice(0, lastSpace);
  return cut.trimEnd() + ending;
}

// Translates each over-limit string again with its limit, keeping the shorter
// translation, and cuts only where Payload would reject the length. When the
// second request fails, the first translations are cut where needed.
export async function fitToLimits(
  gt: GtClient,
  over: OverLimit[],
  { locale, sourceLocale }: { locale: string; sourceLocale: string },
  onError: (error: unknown) => void
): Promise<Map<string, string>> {
  const fitted = new Map<string, string>();
  if (!over.length) return fitted;
  let retried: (string | undefined)[] = [];
  try {
    const results = await gt.translateMany(
      over.map((item) => ({
        source: item.source,
        metadata: { maxChars: item.limit.maxChars, dataFormat: 'STRING' },
      })),
      { targetLocale: locale, sourceLocale }
    );
    retried = results.map((result) =>
      result.success && typeof result.translation === 'string'
        ? result.translation
        : undefined
    );
  } catch (error) {
    onError(error);
  }
  over.forEach((item, index) => {
    const again = retried[index];
    const shorter =
      again !== undefined && again.length < item.translation.length
        ? again
        : item.translation;
    fitted.set(
      item.key,
      item.limit.cutAt === undefined
        ? shorter
        : cutToLength(shorter, item.limit.cutAt, locale)
    );
  });
  return fitted;
}
