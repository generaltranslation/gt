import type { GTParsingFlags } from '../types-dir/config';

/** Resolves `autoderive`: `true` and `{ jsx: true }` both enable it for JSX. */
export function resolveAutoderive(value: GTParsingFlags['autoderive']): {
  jsx: boolean;
} {
  if (value === undefined || typeof value === 'boolean') {
    return { jsx: !!value };
  }
  return { jsx: value.jsx ?? false };
}
