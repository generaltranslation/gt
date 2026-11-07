import type { GTParsingFlags } from '../types-dir/config';

/**
 * Splits `autoderive` into JSX and string flags. A boolean applies to both;
 * parts missing from the object form are off.
 */
export function resolveAutoderive(value: GTParsingFlags['autoderive']): {
  jsx: boolean;
  strings: boolean;
} {
  if (value === undefined || typeof value === 'boolean') {
    return { jsx: !!value, strings: !!value };
  }
  return { jsx: value.jsx ?? false, strings: value.strings ?? false };
}
