import { renderVariable } from './renderVariable';
import {
  renderPreparedT as renderPreparedTShared,
  type RenderPreparedTParams,
} from './renderPreparedT.shared';
import type { ReactNode } from 'react';

// Hook-capable wrapper: binds the variable renderer backed by the hook-based
// variable components. RSC code must use renderPreparedT.rsc instead.

function renderPreparedT(params: RenderPreparedTParams): ReactNode {
  return renderPreparedTShared({ ...params, renderVariable });
}

export { renderPreparedT };
