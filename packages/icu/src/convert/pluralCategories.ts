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
 * Enough counts to reach every category of CLDR's rules: they read a whole
 * number modulo 1,000 at most, Romance `many` starts at a million, and
 * Russian `other` and Czech `many` take only fractions.
 */
const PROBED_COUNTS: readonly number[] = [
  ...Array.from({ length: 1001 }, (_, count) => count),
  ...Array.from({ length: 6 }, (_, index) => (index + 1) * 1_000_000),
  ...Array.from({ length: 1001 }, (_, count) => count + 0.5),
];

/**
 * Whether a category takes a fraction that is no half, as Sinhala `one`
 * takes 0.1 and 0.01. CLDR reads a fraction's digits, and the whole number
 * beside them, modulo 100 at most.
 */
function takesAnotherFraction(
  rules: Intl.PluralRules,
  category: string
): boolean {
  for (let whole = 0; whole < 100; whole++) {
    for (let hundredths = 1; hundredths < 100; hundredths++) {
      if (rules.select(whole + hundredths / 100) === category) return true;
    }
  }
  return false;
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
  const key = JSON.stringify([resolved, type, category]);
  const known = categoryCounts.get(key);
  if (known) return known;
  const counts: number[] = [];
  let more = false;
  for (const count of PROBED_COUNTS) {
    if (rules.select(count) !== category) continue;
    // CLDR reads a fraction's digits modulo 10 or 100, so a category that picks one fraction picks endless others.
    if (!Number.isInteger(count)) more = true;
    if (counts.length === SAMPLED_COUNTS) {
      more = true;
      break;
    }
    counts.push(count);
  }
  more ||= takesAnotherFraction(rules, category);
  const found = { counts, more };
  categoryCounts.set(key, found);
  return found;
}
