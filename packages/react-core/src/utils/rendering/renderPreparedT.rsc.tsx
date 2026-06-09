import { renderVariable } from './renderVariable.rsc';
import {
  renderPreparedT as renderPreparedTShared,
  type RenderPreparedTParams,
} from './renderPreparedT.shared';
import type { ReactNode } from 'react';

// RSC wrapper: binds the RSC variable renderer. This module must stay free of
// hook/context imports so it can be reached from the context-rsc entrypoint.

function renderPreparedT(params: RenderPreparedTParams): ReactNode {
  return renderPreparedTShared({ ...params, renderVariable });
}

export { renderPreparedT };
