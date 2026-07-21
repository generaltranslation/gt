import { getRequestConditions } from '../../request/getRequestConditions';
import { T as RscT } from 'gt-react';
import { renderPreparedT } from './renderPipeline';
import type { ReactNode } from 'react';

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

/** @internal _gtt - The GT transformation for the component. */
T._gtt = 'translate-server';
GtInternalTranslateJsx._gtt = 'translate-server-automatic';
