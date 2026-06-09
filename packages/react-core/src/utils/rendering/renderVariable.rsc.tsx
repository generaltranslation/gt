import {
  RscCurrency,
  RscGtInternalCurrency,
} from '../../components/variables/Currency.rsc';
import {
  RscDateTime,
  RscGtInternalDateTime,
} from '../../components/variables/DateTime.rsc';
import { RscGtInternalNum, RscNum } from '../../components/variables/Num.rsc';
import {
  RscGtInternalRelativeTime,
  RscRelativeTime,
} from '../../components/variables/RelativeTime.rsc';
import { GtInternalVar, Var } from '../../components/variables/Var';
import { createRenderVariable } from './createRenderVariable';
import type { RenderVariable } from '../types';

// RSC renderer: backed by the Rsc variable implementations, which receive
// request conditions explicitly. This module must stay free of hook/context
// imports so it can be reached from the context-rsc entrypoint. (Var is
// already a pure module, so it is reused rather than duplicated.)

const renderVariable: RenderVariable = createRenderVariable({
  Currency: RscCurrency,
  GtInternalCurrency: RscGtInternalCurrency,
  DateTime: RscDateTime,
  GtInternalDateTime: RscGtInternalDateTime,
  Num: RscNum,
  GtInternalNum: RscGtInternalNum,
  RelativeTime: RscRelativeTime,
  GtInternalRelativeTime: RscGtInternalRelativeTime,
  Var,
  GtInternalVar,
});

// ===== Exports ===== //

export { renderVariable };
