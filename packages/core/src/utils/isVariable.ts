import type { Variable } from '@generaltranslation/format';

// An element never has a `v`.
export function isVariable(obj: unknown): obj is Variable {
  return (
    !!obj && typeof obj === 'object' && typeof (obj as Variable).v === 'string'
  );
}
