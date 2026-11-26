import type { Transformation } from 'generaltranslation/types';

/**
 * Tags a component with its GT transformation (`_gtt`).
 *
 * Call sites should mark the call with a pure annotation comment (`__PURE__`
 * prefixed with `@`) so bundlers can drop components that are never
 * referenced (e.g. dev-only variants in production builds). A plain `Component._gtt = ...` assignment at module level
 * counts as a side effect to esbuild and Terser, which keeps the component alive.
 *
 * The annotation is spelled out in words here on purpose: the dist keeps this
 * comment (no minification), and Rollup warns about annotations it finds in
 * comments it cannot apply them to.
 *
 * Only pass a function and literals here: any work done while evaluating the
 * arguments is dropped along with the call.
 *
 * @internal
 */
export function withGtt<
  F extends (...args: never[]) => unknown,
  G extends Transformation,
>(fn: F, gtt: G, displayName?: string): F & { _gtt: G } {
  return Object.assign(
    fn,
    displayName ? { _gtt: gtt, displayName } : { _gtt: gtt }
  );
}
