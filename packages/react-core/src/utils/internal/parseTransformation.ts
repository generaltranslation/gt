import { InjectionType, TransformationPrefix } from 'generaltranslation/types';

// `<prefix>-<suffix>[-automatic|-manual]`; a suffix may contain a hyphen
// (`variable-relative-time`), so never split on every hyphen.
export function parseTransformation(transformation: string): {
  prefix: TransformationPrefix;
  suffix: string | undefined;
  injectionType: InjectionType;
} {
  const segments = transformation.trim().split('-');
  const lastSegment = segments[segments.length - 1];
  let injectionType: InjectionType = 'manual';
  if (lastSegment === 'automatic' || lastSegment === 'manual') {
    injectionType = lastSegment;
    segments.pop();
  }
  return {
    prefix: segments[0] as TransformationPrefix,
    suffix: segments.length > 1 ? segments.slice(1).join('-') : undefined,
    injectionType,
  };
}
