export type VariableType =
  | 'v' // Variable.
  | 'n' // Number.
  | 'd' // Date.
  | 'c' // Currency.
  | 'rt'; // Relative time.

/**
 * Stores the variable name and type.
 */
export type Variable = {
  k: string;
  i?: number;
  v?: VariableType;
};
