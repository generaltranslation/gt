import { VariableTransformationSuffix, VariableType } from '../types';

const VARIABLE_TRANSFORMATION_SUFFIXES_TO_MINIFIED_NAMES = {
  variable: 'v',
  number: 'n',
  datetime: 'd',
  currency: 'c',
  static: 's',
} as const;

export function minifyVariableType(
  variableType: VariableTransformationSuffix
): VariableType {
  return VARIABLE_TRANSFORMATION_SUFFIXES_TO_MINIFIED_NAMES[variableType];
}
