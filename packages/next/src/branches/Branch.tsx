import { Branch as CoreBranch } from 'gt-react';
import { getRequestConditions } from '../request/getRequestConditions';
import type { ReactNode } from 'react';
import type { GTComponentMetadata } from '@generaltranslation/react-core/pure';

type BranchProps = Parameters<typeof CoreBranch>[0];

export async function Branch(props: BranchProps): Promise<ReactNode> {
  const conditions = await getRequestConditions();
  return <CoreBranch {...props} {...conditions} />;
}

/** @internal _gtt - The GT metadata for the component. */
Branch._gtt = { kind: 'branch' } satisfies GTComponentMetadata;
