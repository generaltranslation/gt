export type VariableType =
  | 'v' // Variable
  | 'n' // Number
  | 'd' // Date
  | 'c'; // Currency

/**
 * Variables are used to store the variable name and type.
 */
export type Variable = {
  k: string;
  i?: number;
  v?: VariableType;
};
