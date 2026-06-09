import { renderVariable } from './renderVariable.rsc';
import { createRenderPipeline } from './createRenderPipeline';

// RSC render pipeline: bound to the variable renderer backed by the Rsc
// variable implementations, which receive request conditions explicitly.
// This module must stay free of hook/context imports so it can be reached
// from the context-rsc entrypoint.

export const {
  renderDefaultChildren,
  renderTranslatedChildren,
  renderPreparedT,
} = createRenderPipeline({ renderVariable });
