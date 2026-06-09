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
import { createRenderVariable } from './createRenderVariable';
import type { RenderVariable } from '../types';

// Hook-capable renderer: backed by the variable components that resolve
// request conditions from hooks. RSC code must use renderVariable.rsc instead.

const renderVariable: RenderVariable = createRenderVariable({
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

// ===== Exports ===== //

export { renderVariable };
