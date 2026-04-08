/**
 * Transformations are made from a prefix and a suffix.
 */
export type Transformation =
  | BaseTransformation
  | `${BaseTransformation}-${InjectionType}`;
export type BaseTransformation =
  | 'translate-client'
  | 'translate-server'
  | 'translate-runtime'
  | 'variable-variable'
  | 'variable-currency'
  | 'variable-datetime'
  | 'variable-number'
  | 'variable-relative-time'
  | 'plural'
  | 'branch'
  | 'derive';
export type TransformationPrefix =
  | 'translate'
  | 'variable'
  | 'plural'
  | 'branch'
  | 'fragment'
  | 'derive';
export type VariableTransformationSuffix =
  | 'variable'
  | 'number'
  | 'datetime'
  | 'currency'
  | 'relative-time';
export type InjectionType = 'automatic' | 'manual';
