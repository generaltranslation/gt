import { minifyVariableType } from 'generaltranslation/internal';
import type { VariableTransformationSuffix } from 'generaltranslation/types';
import type { TaggedElement, VariableProps } from '../types';
import { getVNodeChildren } from './vnode-utils';

const defaultVariableNames: Record<VariableTransformationSuffix, string> = {
  variable: 'value',
  number: 'n',
  datetime: 'date',
  currency: 'cost',
  'relative-time': 'time',
};

export function getVariableName(
  props: Record<string, unknown>,
  variableType: VariableTransformationSuffix,
  id: number
): string {
  if (typeof props.name === 'string') return props.name;
  const baseVariableName = defaultVariableNames[variableType] || 'value';
  return `_gt_${baseVariableName}_${id}`;
}

export function isVariableTaggedElement(child: TaggedElement): boolean {
  return child.gt.transformation === 'variable';
}

/**
 * Extracts the render-time variable properties from a tagged variable element:
 * name, minified type, current value, and formatting options.
 */
export function getVariableProps(child: TaggedElement): VariableProps {
  const variableType = child.gt.variableType || 'variable';
  const props = (child.vnode.props ?? {}) as Record<string, unknown>;

  const variableValue = (() => {
    if (typeof props.value !== 'undefined') return props.value;
    if (typeof props.date !== 'undefined') return props.date;
    const slotChildren = getVNodeChildren(child.vnode);
    if (slotChildren != null) return slotChildren;
    return undefined;
  })();

  const variableOptions = (() => {
    const options = {
      ...(typeof props.currency !== 'undefined' && {
        currency: props.currency,
      }),
      ...(typeof props.unit !== 'undefined' && { unit: props.unit }),
      ...(typeof props.baseDate !== 'undefined' && {
        baseDate: props.baseDate,
      }),
      ...(typeof props.options === 'object' && props.options),
    } as Record<string, unknown>;
    if (Object.keys(options).length) return options;
    return undefined;
  })();

  return {
    variableName: getVariableName(props, variableType, child.gt.id),
    variableType: minifyVariableType(variableType),
    variableValue,
    variableOptions,
  };
}
