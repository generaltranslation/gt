import { createRenderDefaultChildren } from '../../utils/rendering/renderDefaultChildren.shared';
import { createRenderPreparedT } from '../../utils/rendering/renderPreparedT.shared';
import { renderVariable } from '../../utils/rendering/renderPipeline';
import { createLocaleTwinRenderTranslatedChildren } from './renderTranslatedChildren';

/**
 * `renderPreparedT` for content from a locale twin: the hook-based variable
 * components, rendering translations into stripped source children.
 */
export const renderLocaleTwinPreparedT = createRenderPreparedT({
  renderDefaultChildren: createRenderDefaultChildren({ renderVariable }),
  renderTranslatedChildren: createLocaleTwinRenderTranslatedChildren({
    renderVariable,
  }),
});
