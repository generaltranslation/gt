import type { ReactNode } from 'react';
import { getBranch } from '../../utils/plurals/getPluralBranch';
import type { GTMarker } from '../../utils/marker';

type SelectValue = string | number | boolean;

// True when some member is any string or number, like `string` or `id-${string}`.
type IsOpen<K extends string> = K extends unknown
  ? {} extends Record<K, 1>
    ? true
    : false
  : never;

// A value named `other` has no prop of its own: it renders the children.
type Named<V extends SelectValue> = Exclude<`${V}`, 'other'>;

/**
 * Like `select()`: a branch for every value of a finite union, or children as
 * the fallback, as `other` is in `select()`. `value={isAdmin}` takes `true`
 * and `false` branches.
 */
type SelectProps<V extends SelectValue = SelectValue> = {
  value: V;
} & (true extends IsOpen<`${V}`>
  ? { children: ReactNode; [branch: string]: ReactNode }
  : Partial<Record<Named<V>, ReactNode>> &
      (
        | ('other' extends `${V}`
            ? never
            : Record<Named<V>, ReactNode> & { children?: ReactNode })
        | { children: ReactNode }
      ));

type InternalSelectProps = {
  value?: SelectValue;
  children?: ReactNode;
  [branch: string]: ReactNode;
};

// ===== Component ===== //

/**
 * External-store version of the `<Select>` component.
 */
function GtInternalSelect({
  value,
  children,
  ...branches
}: InternalSelectProps): ReactNode {
  return getBranch(
    value,
    { ...branches, other: children },
    // Build tools inject data-* attributes, which are not branches.
    String(value).startsWith('data-') ? 'other' : undefined
  );
}

function Select<V extends SelectValue>(
  props: SelectProps<V>
): React.JSX.Element {
  return <GtInternalSelect {...props} />;
}

/** @internal _gtt - The GT transformation for the component. */
Select._gtt = { kind: 'select' } satisfies GTMarker;
GtInternalSelect._gtt = { kind: 'select', automatic: true } satisfies GTMarker;

// ===== Exports ===== //

export { GtInternalSelect, Select };
export type { SelectProps };
