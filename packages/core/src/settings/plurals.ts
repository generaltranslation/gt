export const pluralForms = [
  'zero',
  'one',
  'two',
  'few',
  'many',
  'other',
] as const;
export type PluralType = (typeof pluralForms)[number];

const EXACT_PLURAL_PROP = /^_(0|[1-9]\d*)$/;

/**
 * Whether a `<Plural>` prop is a branch: a plural category, or `_N` for the
 * exact number N, since `=N` is not a legal JSX attribute name. `other` is
 * not a prop: it is the children.
 */
export function isAcceptedPluralForm(form: string): boolean {
  return (
    (form !== 'other' && pluralForms.includes(form as PluralType)) ||
    EXACT_PLURAL_PROP.test(form)
  );
}

/** The key a `<Plural>` branch prop is stored under: `_0` is ICU's `=0`. */
export function getPluralBranchKey(prop: string): string {
  return EXACT_PLURAL_PROP.test(prop) ? `=${prop.slice(1)}` : prop;
}
