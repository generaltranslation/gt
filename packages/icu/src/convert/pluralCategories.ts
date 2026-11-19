import { PLURAL_CATEGORIES } from '../settings/syntax';

/**
 * The plural categories a locale uses, cardinal or ordinal, in CLDR's order.
 * Nothing when Intl has no plural rules for the locale: Intl would answer
 * with the host's language instead.
 */
export function getPluralCategories(
  locale: string,
  type: Intl.PluralRuleType
): string[] | undefined {
  if (!Intl.PluralRules.supportedLocalesOf(locale).length) return undefined;
  const used: readonly string[] = new Intl.PluralRules(locale, {
    type,
  }).resolvedOptions().pluralCategories;
  return [...PLURAL_CATEGORIES].filter((category) => used.includes(category));
}

/** The first counts a locale picks a plural category for, and whether it picks it for more. */
export type PluralCategoryCounts = { counts: number[]; more: boolean };

const SAMPLED_COUNTS = 4;

/**
 * Enough counts to reach every category of CLDR's rules. They read a whole
 * number modulo 1,000 at most, and Romance `many` starts at a million.
 * Russian `other` and Czech `many` take only fractions: halves come first,
 * then every other one- and two-digit fraction, since Sinhala `one` takes
 * 0.1 and 0.01 and no half. CLDR reads a fraction's digits, and the whole
 * number beside them, modulo 100 at most.
 */
function* probedCounts(): Generator<number> {
  for (let count = 0; count <= 1000; count++) yield count;
  for (let million = 1; million <= 6; million++) yield million * 1_000_000;
  for (let count = 0; count <= 1000; count++) yield count + 0.5;
  for (let whole = 0; whole < 100; whole++) {
    for (let hundredths = 1; hundredths < 100; hundredths++) {
      if (hundredths !== 50) yield whole + hundredths / 100;
    }
  }
}

// By the locale Intl resolves and its own categories, so input cannot grow it past CLDR's.
const categoryCounts = new Map<string, PluralCategoryCounts>();

/**
 * The first counts a locale picks a plural category for, whole numbers
 * before fractions, and whether it picks it for more of them. Russian `one`
 * is `{ counts: [1, 21, 31, 41], more: true }`, German `one` only
 * `{ counts: [1], more: false }`. Nothing when Intl has no plural rules for
 * the locale, as with `getPluralCategories`.
 */
export function getPluralCategoryCounts(
  locale: string,
  type: Intl.PluralRuleType,
  category: string
): PluralCategoryCounts | undefined {
  if (!Intl.PluralRules.supportedLocalesOf(locale).length) return undefined;
  const rules = new Intl.PluralRules(locale, { type });
  const { locale: resolved, pluralCategories } = rules.resolvedOptions();
  const used: readonly string[] = pluralCategories;
  if (!used.includes(category)) return { counts: [], more: false };
  const key = [resolved, type, category].join();
  const known = categoryCounts.get(key);
  if (known) return known;
  const counts: number[] = [];
  let more = false;
  for (const count of probedCounts()) {
    if (rules.select(count) !== category) continue;
    // CLDR reads a fraction's digits modulo 10 or 100, so a category that picks one fraction picks endless others.
    more ||= !Number.isInteger(count);
    // A fraction that is no half is not listed: it only tells that there are more.
    if (counts.length === SAMPLED_COUNTS || !Number.isInteger(count * 2)) {
      more = true;
      break;
    }
    counts.push(count);
  }
  const found = { counts, more };
  categoryCounts.set(key, found);
  return found;
}
