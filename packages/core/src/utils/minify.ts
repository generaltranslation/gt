import type { VariableType } from '@generaltranslation/format';

const VARIABLE_TRANSFORMATION_SUFFIXES_TO_MINIFIED_NAMES = {
  variable: 'v',
  number: 'n',
  datetime: 'd',
  currency: 'c',
  relativetime: 'rt',
  count: '#',
} as const;

export function minifyVariableType(
  variableType: keyof typeof VARIABLE_TRANSFORMATION_SUFFIXES_TO_MINIFIED_NAMES
): VariableType {
  return VARIABLE_TRANSFORMATION_SUFFIXES_TO_MINIFIED_NAMES[variableType];
}
