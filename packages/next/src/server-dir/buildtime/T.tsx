import { getRequestConditions } from '../../request/getRequestConditions';
import {
  T as RscT,
  type TProps,
} from '@generaltranslation/react-core/components-rsc';
import { renderPreparedT } from './renderPipeline';
import type { ReactNode } from 'react';
import type { GTMarker } from '@generaltranslation/react-core/pure';

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
T._gtt = { kind: 'translate' } satisfies GTMarker;
GtInternalTranslateJsx._gtt = {
  kind: 'translate',
  automatic: true,
} satisfies GTMarker;
