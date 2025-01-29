export const pluralForms = ["singular", "plural", "dual", "zero", "one", "two", "few", "many", "other"] as const;
export type PluralType = (typeof pluralForms)[number];
export function isAcceptedPluralForm(
    form: string
  ): form is PluralType {
    return pluralForms.includes(form as (typeof pluralForms)[number]);
}