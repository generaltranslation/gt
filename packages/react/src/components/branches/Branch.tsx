import { GtInternalBranch } from '@generaltranslation/react-core/context';

type BranchProps = Parameters<typeof GtInternalBranch>[0];

// ===== Component ===== //

function RscBranch(props: BranchProps): React.JSX.Element {
  return <GtInternalBranch {...props} />;
}

/** @internal _gtt - The GT transformation for the component. */
RscBranch._gtt = 'branch';

// ===== Exports ===== //

export { RscBranch };
