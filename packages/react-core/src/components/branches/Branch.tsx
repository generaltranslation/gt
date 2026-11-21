import type { ReactNode } from 'react';
import { getBranch } from '../../utils/plurals/getPluralBranch';
import type { GTMarker } from '../../utils/marker';

type BranchValue = string | number | boolean;

// True when some member is any string or number, like `string` or `id-${string}`.
type IsOpen<K extends string> = K extends unknown
  ? {} extends Record<K, 1>
    ? true
    : false
  : never;

// A value named `other` has no prop of its own: it renders the children.
type Named<V extends BranchValue> = Exclude<`${V}`, 'other'>;

/**
 * Like `select()`: a branch for every value of a finite union, or children as
 * the fallback, as `other` is in `select()`. `branch={isAdmin}` takes `true`
 * and `false` branches.
 */
type BranchProps<V extends BranchValue = BranchValue> = {
  branch: V;
} & (true extends IsOpen<`${V}`>
  ? { children: ReactNode; [branch: string]: ReactNode }
  : Partial<Record<Named<V>, ReactNode>> &
      (
        | ('other' extends `${V}`
            ? never
            : Record<Named<V>, ReactNode> & { children?: ReactNode })
        | { children: ReactNode }
      ));

type InternalBranchProps = {
  branch?: BranchValue;
  children?: ReactNode;
  [branch: string]: ReactNode;
};

// ===== Component ===== //

/**
 * External-store version of the `<Branch>` component.
 */
function GtInternalBranch({
  branch,
  children,
  ...branches
}: InternalBranchProps): ReactNode {
  return getBranch(
    branch,
    { ...branches, other: children },
    // Build tools inject data-* attributes, which are not branches.
    String(branch).startsWith('data-') ? 'other' : undefined
  );
}

function Branch<V extends BranchValue>(
  props: BranchProps<V>
): React.JSX.Element {
  return <GtInternalBranch {...props} />;
}

/** @internal _gtt - The GT transformation for the component. */
Branch._gtt = { kind: 'branch' } satisfies GTMarker;
GtInternalBranch._gtt = { kind: 'branch', automatic: true } satisfies GTMarker;

// ===== Exports ===== //

export { GtInternalBranch, Branch };
export type { BranchProps };
