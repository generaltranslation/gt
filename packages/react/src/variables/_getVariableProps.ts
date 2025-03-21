import { VariableProps } from '../types/types';
import getVariableName from './getVariableName';

export default function getVariableProps(props: {
  'data-_gt'?: {
    transformation: 'variable';
    [key: string]: any;
  };
  [key: string]: any;
}): VariableProps {
  const variableType: 'variable' | 'number' | 'datetime' | 'currency' =
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
        ...(props.currency && { currency: props.currency }),
        ...(props.options && { ...props.options }),
      };
      if (Object.keys(variableOptions).length) return variableOptions;
      if (typeof props['data-_gt-variable-options'] === 'string')
        return JSON.parse(props['data-_gt-variable-options']);
      return props['data-_gt-variable-options'] || undefined;
    })(),
  };

  return result;
}
