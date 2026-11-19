import { VARIABLE_TYPES, type VariableType } from '@generaltranslation/format';

import { COUNT_NODE_TYPE } from '../jsx/utils/constants.js';

/**
 * The variable components as they appear in gt-next and gt-react, and their minified types
 */
export const minifyVariableTypeMap = {
  Var: VARIABLE_TYPES.variable,
  GtInternalVar: VARIABLE_TYPES.variable,
  Num: VARIABLE_TYPES.number,
  DateTime: VARIABLE_TYPES.datetime,
  RelativeTime: VARIABLE_TYPES.relativetime,
  Currency: VARIABLE_TYPES.currency,
  // An <N> imported from GT.
  [COUNT_NODE_TYPE]: VARIABLE_TYPES.count,
} as const satisfies Record<string, VariableType>;

/**
 * Minify the variable type from the name of the variable component (from gt-next and gt-react)
 * @param variableType - The type of the variable (Var, Num, DateTime, Currency)
 * @returns The minified variable type
 */
export const minifyVariableType = (
  variableType: keyof typeof minifyVariableTypeMap
): VariableType => {
  return minifyVariableTypeMap[variableType];
};
