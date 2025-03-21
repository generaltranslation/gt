const defaultVariableNames = {
  variable: 'value',
  number: 'n',
  datetime: 'date',
  currency: 'cost',
} as const;

export const baseVariablePrefix = '_gt_';

export default function getVariableName(
  props: Record<string, any> = {},
  variableType: string
): string {
  const baseVariableName =
    (defaultVariableNames as Record<string, any>)[variableType] || 'value';
  return `${baseVariablePrefix}${baseVariableName}_${props['data-_gt']?.id}`;
}
