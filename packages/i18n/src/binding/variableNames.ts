import type { VariableTransformationSuffix } from 'generaltranslation/types';

const defaultVariableNames: Record<VariableTransformationSuffix, string> = {
  variable: 'value',
  number: 'n',
  datetime: 'date',
  currency: 'cost',
  'relative-time': 'time',
};

export const baseVariablePrefix = '_gt_';

/**
 * Resolves the wire-format variable name for a variable component: an
 * explicit `name` prop, or a generated `_gt_<base>_<id>` name.
 *
 * Shared by the framework bindings (gt-react via react-core, gt-vue).
 */
export function getVariableName(
  props: Record<string, unknown>,
  variableType: VariableTransformationSuffix,
  id: number | undefined
): string {
  if (typeof props.name === 'string') return props.name;
  const baseVariableName = defaultVariableNames[variableType] || 'value';
  return `${baseVariablePrefix}${baseVariableName}_${id}`;
}
