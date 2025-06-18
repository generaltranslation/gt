import { GTProp, VariableTransformationSuffix } from 'generaltranslation/types';
import { VariableProps } from '../types/types';
import getVariableName from './getVariableName';

type VariableElementProps = {
  'data-_gt': GTProp & {
    transformation: 'variable';
  };
  [key: string]: unknown;
};

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

export default function getVariableProps(
  props: VariableElementProps
): VariableProps {
  const variableType: VariableTransformationSuffix =
    props['data-_gt']?.variableType || 'variable';

  const result: VariableProps = {
    variableName: getVariableName(props, variableType),
    variableType,
    variableValue: (() => {
      if (typeof props.value !== 'undefined') return props.value;
      if (typeof props['data-_gt-unformatted-value'] !== 'undefined')
        return props['data-_gt-unformatted-value'];
      if (typeof props.children !== 'undefined') return props.children;
      return undefined;
    })(),
    variableOptions: (() => {
      const variableOptions = {
        ...(typeof props.currency !== 'undefined' && {
          currency: props.currency,
        }),
        ...(typeof props.options !== 'undefined' && {
          options: props.options,
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
