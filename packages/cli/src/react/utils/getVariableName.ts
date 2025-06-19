/**
 * These are the names of the variable components as they appear in gt-next and gt-react
 */
export const defaultVariableNames = {
  Var: 'value',
  Num: 'n',
  DateTime: 'date',
  Currency: 'cost',
} as const;

const minifyVariableTypeMap = {
  Var: 'v',
  Num: 'n',
  DateTime: 'd',
  Currency: 'c',
} as const;

/**
 * Minify the variable type from the name of the variable component (from gt-next and gt-react)
 * @param variableType - The type of the variable (Var, Num, DateTime, Currency)
 * @returns The minified variable type
 */
export const minifyVariableType = (
  variableType: keyof typeof defaultVariableNames
): string => {
  return minifyVariableTypeMap[variableType];
};

export const baseVariablePrefix = '_gt_';

/**
 * Get the name of a variable
 * @param props - The props of the variable
 * @param variableType - The type of the variable (Var, Num, DateTime, Currency)
 * @param id - The id of the variable
 * @returns The name of the variable
 */
export function getVariableName(
  props: Record<string, any> = {},
  variableType: keyof typeof defaultVariableNames,
  id: number
): string {
  if (props.name) return props.name;
  const baseVariableName =
    (defaultVariableNames as Record<string, any>)[variableType] || 'value';
  return `${baseVariablePrefix}${baseVariableName}_${id}`;
}
