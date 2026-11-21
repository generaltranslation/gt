import type { VariableType } from '@generaltranslation/format';
import { GTTag, VariableProps } from '../types';

type VariableElementProps = {
  'data-_gt': GTTag & {
    transformation: 'variable';
  };
  [key: string]: unknown;
};

/** The type of a count variable, which is to its plural what `#` is in ICU. */
export const COUNT_VARIABLE_TYPE = '#' satisfies VariableType;

export function isVariableElementProps(
  props: unknown
): props is VariableElementProps {
  return (
    typeof props === 'object' &&
    !!props &&
    'data-_gt' in props &&
    typeof props['data-_gt'] === 'object' &&
    !!props['data-_gt'] &&
    'transformation' in props['data-_gt'] &&
    props['data-_gt']?.transformation === 'variable'
  );
}

export function getVariableProps(props: VariableElementProps): VariableProps {
  const result: VariableProps = {
    variableId: props['data-_gt'].id,
    variableType: props['data-_gt'].variableType,
    injectionType: props['data-_gt']?.injectionType || 'manual',
    variableValue: (() => {
      if (typeof props.value !== 'undefined') return props.value;
      if (typeof props['data-_gt-unformatted-value'] !== 'undefined')
        return props['data-_gt-unformatted-value'];
      if (typeof props.children !== 'undefined') return props.children;
      // An `<N>` keeps the count its `<Plural>` gave it here.
      if (typeof props._count !== 'undefined') return props._count;
      return undefined;
    })(),
    variableOptions: (() => {
      const variableOptions = {
        ...(typeof props.unit !== 'undefined' && {
          unit: props.unit,
        }),
        ...(typeof props.baseDate !== 'undefined' && {
          baseDate: props.baseDate,
        }),
        ...(typeof props.options !== 'undefined' && props.options),
        ...(typeof props.currency !== 'undefined' && {
          currency: props.currency,
        }),
      };
      if (Object.keys(variableOptions).length) return variableOptions;
      if (typeof props['data-_gt-variable-options'] === 'string')
        return JSON.parse(props['data-_gt-variable-options']);
      return props['data-_gt-variable-options'] || undefined;
    })(),
  };

  return result;
}
