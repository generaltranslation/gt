import {
  createRenderVariable,
  type VariableComponents,
} from './createRenderVariable';
import {
  createRenderDefaultChildren,
  type RenderDefaultChildrenArgs,
} from './renderDefaultChildren.shared';
import {
  createRenderTranslatedChildren,
  type RenderTranslatedChildrenArgs,
} from './renderTranslatedChildren.shared';
import {
  createRenderPreparedT,
  type RenderPreparedTParams,
} from './renderPreparedT.shared';
import type { ReactNode } from 'react';
import type { RenderVariable } from '../types';

// Factory binding variable components to the shared rendering logic. The
// renderVariable dependency injection stays internal to this factory: callsites
// import a pre-instantiated pipeline (renderPipeline for the hook-based
// variable components, renderPipeline.rsc for the RSC ones) instead of
// threading renderVariable through every rendering call. This keeps shared
// rendering code free of static imports of either variable implementation.

type RenderPipeline = {
  renderVariable: RenderVariable;
  renderDefaultChildren: (args: RenderDefaultChildrenArgs) => ReactNode;
  renderTranslatedChildren: (args: RenderTranslatedChildrenArgs) => ReactNode;
  renderPreparedT: (args: RenderPreparedTParams) => ReactNode;
};

function createRenderPipeline(components: VariableComponents): RenderPipeline {
  const renderVariable = createRenderVariable(components);
  const renderDefaultChildren = createRenderDefaultChildren({ renderVariable });
  const renderTranslatedChildren = createRenderTranslatedChildren({
    renderVariable,
  });
  const renderPreparedT = createRenderPreparedT({
    renderDefaultChildren,
    renderTranslatedChildren,
  });

  return {
    renderVariable,
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
