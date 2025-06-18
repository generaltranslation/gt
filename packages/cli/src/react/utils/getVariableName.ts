const defaultVariableNames = {
  variable: 'value',
  number: 'n',
  datetime: 'date',
  currency: 'cost',
} as const;

export const baseVariablePrefix = '_gt_';

export function getVariableName(
  props: Record<string, any> = {},
  variableType: 'variable' | 'number' | 'datetime' | 'currency',
  id: number
): string {
  if (props.name) return props.name;
  const baseVariableName =
    (defaultVariableNames as Record<string, any>)[variableType] || 'value';
  return `${baseVariablePrefix}${baseVariableName}_${id}`;
}
