export type VariableType =
  | 'v' // Variable
  | 'n' // Number
  | 'd' // Date
  | 'c' // Currency
  | 'rt'; // Relative Time

/**
 * A variable is found by its id. `k` is the name its author gave it, if any.
 */
export type Variable = {
  i: number;
  v: VariableType;
  k?: string;
};
