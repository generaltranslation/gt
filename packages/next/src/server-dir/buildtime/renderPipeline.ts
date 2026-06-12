import { Currency } from '../../variables/Currency';
import { DateTime } from '../../variables/DateTime';
import { Num } from '../../variables/Num';
import { RelativeTime } from '../../variables/RelativeTime';
import { Var } from '../../variables/Var';
import { createRenderPipeline, type RenderPreparedT } from 'gt-react/context';

const renderPipeline = createRenderPipeline({
  Currency,
  GtInternalCurrency: Currency,
  DateTime,
  GtInternalDateTime: DateTime,
  Num,
  GtInternalNum: Num,
  RelativeTime,
  GtInternalRelativeTime: RelativeTime,
  Var,
  GtInternalVar: Var,
});

export const renderPreparedT: RenderPreparedT = renderPipeline.renderPreparedT;
