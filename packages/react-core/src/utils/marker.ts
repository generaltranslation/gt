import type { VariableType } from '@generaltranslation/format';

/** What a GT component is to the `<T>` around it, set on the component as `_gtt`. */
export type GTMarker = (
  | { kind: 'translate' | 'derive' | 'select' | 'plural' | 'ordinal' }
  | { kind: 'variable'; variableType: VariableType }
) & {
  /** The compiler inserted the component. */
  automatic?: true;
};

export function getMarker(type: unknown): GTMarker | undefined {
  // Reading a property of a client reference throws in a server component.
  try {
    return typeof type === 'function'
      ? (type as { _gtt?: GTMarker })._gtt
      : undefined;
  } catch {
    return undefined;
  }
}
