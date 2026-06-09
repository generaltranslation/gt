import { renderVariable } from './renderVariable';
import { createRenderPipeline } from './createRenderPipeline';

// Hook-capable render pipeline: bound to the variable renderer backed by the
// hook-based variable components. RSC code must use renderPipeline.rsc
// instead.

export const {
  renderDefaultChildren,
  renderTranslatedChildren,
  renderPreparedT,
} = createRenderPipeline({ renderVariable });
