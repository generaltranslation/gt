import type { VariableType } from '@generaltranslation/format';
import { RESERVED_NAME_PREFIX } from '@generaltranslation/icu/internal';

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

/**
 * Get the name of a variable
 * @param props - The props of the variable
 * @param id - The id of the variable
 * @returns The name of the variable
 */
export function getVariableName(
  props: Record<string, unknown> = {},
  id: number
): string {
  if (typeof props.name === 'string') return props.name;
  return `${RESERVED_NAME_PREFIX}${id}`;
}
