import type { ReactNode } from 'react';
import { getBranch } from '../../utils/plurals/getPluralBranch';

type BranchValue = string | number | boolean;

// True when some member is any string or number, like `string` or `id-${string}`.
type IsOpen<K extends string> = K extends unknown
  ? {} extends Record<K, 1>
    ? true
    : false
  : never;

/**
 * Like `select()`: a branch for every value of a finite union, or an `other`
 * branch. `branch={isAdmin}` takes `true` and `false` branches.
 */
type BranchProps<V extends BranchValue = BranchValue> = {
  branch: V;
} & (true extends IsOpen<`${V}`>
  ? { other: ReactNode; children?: never; [branch: string]: ReactNode }
  : Partial<Record<`${V}` | 'other', ReactNode>> &
      (Record<`${V}`, ReactNode> | { other: ReactNode }));

type InternalBranchProps = {
  branch?: BranchValue;
  _locale?: string;
  _enableI18n?: boolean;
  [branch: string]: ReactNode;
};

// ===== Component ===== //

/**
 * External-store version of the `<Branch>` component.
 */
function GtInternalBranch({
  branch,
  _locale,
  _enableI18n,
  ...props
}: InternalBranchProps): ReactNode {
  void _locale;
  void _enableI18n;

  // Build tools inject data-* attributes, which are not branches.
  const branches = Object.fromEntries(
    Object.entries(props).filter(([prop]) => !prop.startsWith('data-'))
  );
  return getBranch(branch, branches);
}

function Branch<V extends BranchValue>(
  props: BranchProps<V>
): React.JSX.Element {
  return <GtInternalBranch {...props} />;
}

/** @internal _gtt - The GT transformation for the component. */
Branch._gtt = 'branch';
GtInternalBranch._gtt = 'branch-automatic';

// ===== Exports ===== //

export { GtInternalBranch, Branch };
export type { BranchProps };
