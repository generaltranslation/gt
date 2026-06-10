import {
  Currency,
  GtInternalCurrency,
} from '../../components/variables/Currency';
import {
  DateTime,
  GtInternalDateTime,
} from '../../components/variables/DateTime';
import { GtInternalNum, Num } from '../../components/variables/Num';
import {
  GtInternalRelativeTime,
  RelativeTime,
} from '../../components/variables/RelativeTime';
import { GtInternalVar, Var } from '../../components/variables/Var';
import { createRenderPipeline } from './createRenderPipeline';

// Hook-capable render pipeline: bound to variable components that resolve
// request conditions from hooks. RSC code must use renderPipeline.rsc instead.

export const {
  renderVariable,
  renderDefaultChildren,
  renderTranslatedChildren,
  renderPreparedT,
} = createRenderPipeline({
  Currency,
  GtInternalCurrency,
  DateTime,
  GtInternalDateTime,
  Num,
  GtInternalNum,
  RelativeTime,
  GtInternalRelativeTime,
  Var,
  GtInternalVar,
});
