/** The code each kind of variable is stored with. */
export const VARIABLE_TYPES = {
  variable: 'v',
  number: 'n',
  datetime: 'd',
  currency: 'c',
  relativetime: 'rt',
  // The count of the nearest plural, as `#` is in ICU
  count: '#',
} as const;

export type VariableType = (typeof VARIABLE_TYPES)[keyof typeof VARIABLE_TYPES];

/**
 * A variable is found by its id. `k` is the name its author gave it, if any.
 * A count is the exception: it shows the `n` of the plural it is in, so a
 * translation can use one in a branch whose source has none.
 */
export type Variable = {
  i: number;
  v: VariableType;
  k?: string;
};
