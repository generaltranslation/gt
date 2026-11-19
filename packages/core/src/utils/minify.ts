import { VARIABLE_TYPES, type VariableType } from '@generaltranslation/format';
import type { VariableTransformationSuffix } from '../types-dir/transformations';

export function minifyVariableType(
  variableType: VariableTransformationSuffix
): VariableType {
  return VARIABLE_TYPES[variableType];
}
