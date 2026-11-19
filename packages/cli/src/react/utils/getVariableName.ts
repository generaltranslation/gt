import type { VariableType } from '@generaltranslation/format';

/**
 * The variable components as they appear in gt-next and gt-react, and their minified types
 */
export const minifyVariableTypeMap = {
  Var: 'v',
  GtInternalVar: 'v',
  Num: 'n',
  DateTime: 'd',
  RelativeTime: 'rt',
  Currency: 'c',
  // An <N> imported from GT: see COUNT_NODE_TYPE.
  '#': '#',
} as const;

/**
 * Minify the variable type from the name of the variable component (from gt-next and gt-react)
 * @param variableType - The type of the variable (Var, Num, DateTime, Currency)
 * @returns The minified variable type
 */
export const minifyVariableType = (
  variableType: keyof typeof minifyVariableTypeMap
): VariableType => {
  return minifyVariableTypeMap[variableType] as VariableType;
};
