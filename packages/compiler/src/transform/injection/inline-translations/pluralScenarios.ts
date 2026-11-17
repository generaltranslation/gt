/** Intl.PluralRules categories, which getPluralForm reads `n` as. */
const PLURAL_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'];

/** |n| as getPluralForm tells it apart: 0, 1, 2, or any other count. */
type CountClass = 0 | 1 | 2 | 'other';

export type PluralScenario = { count: CountClass; category: string };

/**
 * Every (count, category) pair a locale could produce, a superset of each
 * locale's real ones, so pairing checks hold whatever locale renders.
 */
export const PLURAL_SCENARIOS: PluralScenario[] = (
  [0, 1, 2, 'other'] as const
).flatMap((count) =>
  PLURAL_CATEGORIES.map((category) => ({ count, category }))
);

/**
 * The branch getPluralForm (packages/core/src/locales/getPluralForm.ts) picks
 * from `forms` for a scenario, or '' when none applies.
 */
export function selectPluralForm(
  { count, category }: PluralScenario,
  forms: readonly string[]
): string {
  if (count === 0 && forms.includes('zero')) return 'zero';
  if (count === 1) {
    if (forms.includes('singular')) return 'singular';
    if (forms.includes('one')) return 'one';
  }
  if (category === 'one' && forms.includes('singular')) return 'singular';
  if (count === 2) {
    if (forms.includes('dual')) return 'dual';
    if (forms.includes('two')) return 'two';
  }
  if (category === 'two' && forms.includes('dual')) return 'dual';
  if (forms.includes(category)) return category;
  if (forms.includes('plural')) return 'plural';
  if (forms.includes('other')) return 'other';
  return '';
}
