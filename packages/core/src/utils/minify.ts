import type { VariableType } from '@generaltranslation/format/types';
import type { VariableTransformationSuffix } from '../types-dir/transformations';

const VARIABLE_TRANSFORMATION_SUFFIXES_TO_MINIFIED_NAMES = {
  variable: 'v',
  number: 'n',
  datetime: 'd',
  currency: 'c',
  relativetime: 'rt',
} as const;

export function minifyVariableType(
  variableType: VariableTransformationSuffix
): VariableType {
  return VARIABLE_TRANSFORMATION_SUFFIXES_TO_MINIFIED_NAMES[variableType];
}
