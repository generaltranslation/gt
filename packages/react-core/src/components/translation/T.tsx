import { T_Prod, GtInternalTranslateJsx_Prod } from './T.prod';
import { GtInternalTranslateJsx_Dev, T_Dev } from './T.dev';
import { withGtt } from '../helpers/withGtt';

/** @internal _gtt - The GT transformation for the component. */
const TaggedT_Dev = /* @__PURE__ */ withGtt(T_Dev, 'translate-client');
const TaggedT_Prod = /* @__PURE__ */ withGtt(T_Prod, 'translate-client');
const TaggedGtInternalTranslateJsx_Prod = /* @__PURE__ */ withGtt(
  GtInternalTranslateJsx_Prod,
  'translate-client-automatic'
);
const TaggedGtInternalTranslateJsx_Dev = /* @__PURE__ */ withGtt(
  GtInternalTranslateJsx_Dev,
  'translate-client-automatic'
);

export const T =
  process.env.NODE_ENV !== 'production' ? TaggedT_Dev : TaggedT_Prod;
export const GtInternalTranslateJsx =
  process.env.NODE_ENV !== 'production'
    ? TaggedGtInternalTranslateJsx_Dev
    : TaggedGtInternalTranslateJsx_Prod;
