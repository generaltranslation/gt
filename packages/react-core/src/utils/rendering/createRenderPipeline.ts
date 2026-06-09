import renderDefaultChildrenShared, {
  type RenderDefaultChildrenArgs,
} from './renderDefaultChildren.shared';
import renderTranslatedChildrenShared, {
  type RenderTranslatedChildrenArgs,
} from './renderTranslatedChildren.shared';
import {
  renderPreparedT as renderPreparedTShared,
  type RenderPreparedTParams,
} from './renderPreparedT.shared';
import type { ReactNode } from 'react';
import type { RenderVariable } from '../types';

// Factory binding a variable renderer to the shared rendering logic. The
// renderVariable dependency injection stays internal to this factory:
// callsites import a pre-instantiated pipeline (renderPipeline for the
// hook-based variable components, renderPipeline.rsc for the RSC ones)
// instead of threading renderVariable through every rendering call. This is
// what keeps shared rendering code free of static imports of either
// renderVariable implementation.

type RenderPipeline = {
  renderDefaultChildren: (args: RenderDefaultChildrenArgs) => ReactNode;
  renderTranslatedChildren: (args: RenderTranslatedChildrenArgs) => ReactNode;
  renderPreparedT: (args: RenderPreparedTParams) => ReactNode;
};

function createRenderPipeline({
  renderVariable,
}: {
  renderVariable: RenderVariable;
}): RenderPipeline {
  function renderDefaultChildren(args: RenderDefaultChildrenArgs): ReactNode {
    return renderDefaultChildrenShared({ ...args, renderVariable });
  }

  function renderTranslatedChildren(
    args: RenderTranslatedChildrenArgs
  ): ReactNode {
    return renderTranslatedChildrenShared({ ...args, renderVariable });
  }

  function renderPreparedT(args: RenderPreparedTParams): ReactNode {
    return renderPreparedTShared({ ...args, renderVariable });
  }

  return {
    renderDefaultChildren,
    renderTranslatedChildren,
    renderPreparedT,
  };
}

// ===== Exports ===== //

export { createRenderPipeline };
export type { RenderPipeline };
export type {
  RenderDefaultChildrenArgs,
  RenderPreparedTParams,
  RenderTranslatedChildrenArgs,
};
