import type { Transformation } from 'generaltranslation/types';

/**
 * Tags a component with its GT transformation (`_gtt`).
 *
 * Call sites should annotate the call with `/* @__PURE__ *\/` so bundlers can
 * drop components that are never referenced (e.g. dev-only variants in
 * production builds). A plain `Component._gtt = ...` assignment at module level
 * counts as a side effect to esbuild and Terser, which keeps the component alive.
 *
 * Only pass a function and literals here: any work done while evaluating the
 * arguments is dropped along with the call.
 *
 * @example
 * const T_Dev = /* @__PURE__ *\/ withGtt(TDev, 'translate-client', 'T');
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
