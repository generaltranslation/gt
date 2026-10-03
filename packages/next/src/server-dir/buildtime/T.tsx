import { getRequestConditions } from '../../request/getRequestConditions';
import { T as RscT } from 'gt-react';
import { renderPreparedT } from './renderPipeline';
import type { ReactNode } from 'react';
import type { GTComponentMetadata } from '@generaltranslation/react-core/pure';

type TProps = {
  children: ReactNode;
  id?: string;
  context?: string;
  _hash?: string;
  $id?: string;
  $context?: string;
  $maxChars?: number;
  requiresReview?: boolean;
  $requiresReview?: boolean;
  [key: string]: ReactNode;
};

/**
 * Build-time translation component that renders its children in the user's given locale.
 */
export async function T(props: TProps): Promise<ReactNode> {
  return renderT(props);
}

export async function GtInternalTranslateJsx(
  props: TProps
): Promise<ReactNode> {
  return renderT(props);
}

async function renderT(props: TProps): Promise<ReactNode> {
  const conditions = await getRequestConditions();
  return RscT({
    ...props,
    ...conditions,
    _renderPreparedT: renderPreparedT,
  });
}

/** @internal _gtt - The GT metadata for the component. */
T._gtt = { kind: 'translate' } satisfies GTComponentMetadata;
GtInternalTranslateJsx._gtt = {
  kind: 'translate',
  injection: 'automatic',
} satisfies GTComponentMetadata;
