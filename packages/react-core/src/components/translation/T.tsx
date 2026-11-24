import { T_Prod, GtInternalTranslateJsx_Prod } from './T.prod';
import { GtInternalTranslateJsx_Dev, T_Dev } from './T.dev';
import { withGtt } from '../helpers/withGtt';

// The development components are referenced only inside the
// `process.env.NODE_ENV` branches, so bundlers that keep every import a
// module references (Turbopack) still leave them out of production.

/** @internal _gtt - The GT transformation for the component. */
export const T =
  process.env.NODE_ENV !== 'production'
    ? /* @__PURE__ */ withGtt(T_Dev, { kind: 'translate' })
    : /* @__PURE__ */ withGtt(T_Prod, { kind: 'translate' });
export const GtInternalTranslateJsx =
  process.env.NODE_ENV !== 'production'
    ? /* @__PURE__ */ withGtt(GtInternalTranslateJsx_Dev, {
        kind: 'translate',
        automatic: true,
      })
    : /* @__PURE__ */ withGtt(GtInternalTranslateJsx_Prod, {
        kind: 'translate',
        automatic: true,
      });
