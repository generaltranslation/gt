const baseVariablePrefix = '_gt_';

export function getVariableName(props: Record<string, unknown> = {}): string {
  if (typeof props.name === 'string') return props.name;
  const gtTag = props['data-_gt'] as { id?: number } | undefined;
  return `${baseVariablePrefix}${gtTag?.id}`;
}
