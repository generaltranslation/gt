export type VariableType =
  | 'v' // Variable
  | 'n' // Number
  | 'd' // Date
  | 'c' // Currency
  | 'rt' // Relative Time
  | '#'; // The count of the nearest plural, as `#` is in ICU

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
