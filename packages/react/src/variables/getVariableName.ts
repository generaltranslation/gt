const defaultVariableNames = {
  variable: 'value',
  number: 'n',
  datetime: 'date',
  currency: 'cost',
} as const;

export const baseVariablePrefix = '_gt_';

export default function getVariableName(
  props: Record<string, any> = {},
  variableType: keyof typeof defaultVariableNames
): string {
  if (props.name) return props.name;
  const baseVariableName = defaultVariableNames[variableType] || 'value';
  return `${baseVariablePrefix}${baseVariableName}_${props['data-_gt']?.id}`;
}
