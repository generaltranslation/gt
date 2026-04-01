/**
 * Transformations are made from a prefix and a suffix.
 */
export type Transformation =
  | BaseTransformation
  | `${BaseTransformation}-${VariableInjectionType}`;
export type BaseTransformation =
  | 'translate-client'
  | 'translate-server'
  | 'translate-runtime'
  | 'variable-variable'
  | 'variable-currency'
  | 'variable-datetime'
  | 'variable-number'
  | 'plural'
  | 'branch';
export type TransformationPrefix =
  | 'translate'
  | 'variable'
  | 'plural'
  | 'branch'
  | 'fragment';
export type VariableTransformationSuffix =
  | 'variable'
  | 'number'
  | 'datetime'
  | 'currency';
export type VariableInjectionType = 'automatic' | 'manual';
