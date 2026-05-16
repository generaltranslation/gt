const defaultVariableNames = {
  variable: 'value',
  number: 'n',
  datetime: 'date',
  currency: 'cost',
  'relative-time': 'time',
} as const;

export const baseVariablePrefix = '_gt_';

export default function getVariableName(
  props: Record<string, unknown> = {},
  variableType: keyof typeof defaultVariableNames
): string {
  if (typeof props.name === 'string') return props.name;
  const baseVariableName = defaultVariableNames[variableType] || 'value';
  const gtTag = props['data-_gt'] as { id?: number } | undefined;
  return `${baseVariablePrefix}${baseVariableName}_${gtTag?.id}`;
}
