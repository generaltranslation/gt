export declare const pluralForms: readonly [
  'singular',
  'plural',
  'dual',
  'zero',
  'one',
  'two',
  'few',
  'many',
  'other',
];
export type PluralType = (typeof pluralForms)[number];
export declare function isAcceptedPluralForm(form: string): form is PluralType;
