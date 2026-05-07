import { ReactNode } from 'react';

/**
 * Marks JSX children as derivable by the GT compiler and CLI.
 *
 * Use `<Derive>` inside translated JSX when child content is computed from
 * source code, but should still be discovered during extraction instead of
 * treated as a runtime interpolation variable. It renders its children
 * unchanged at runtime.
 *
 * Run `gt validate` after adding or changing `<Derive>` usage to verify that
 * each derivable expression can be resolved by the CLI.
 *
 * This is the i18n-context version and does not use React Context.
 */
function Derive<T extends ReactNode>({ children }: { children: T }): T {
  return children;
}

/**
 * Equivalent to the `<Derive>` component, but used for auto insertion.
 */
function GtInternalDerive<T extends ReactNode>({
  children,
}: {
  children: T;
}): T {
  return children;
}

/** @internal _gtt - The GT transformation and injection identifier for the component. */
Derive._gtt = 'derive';
GtInternalDerive._gtt = 'derive-automatic';

export { GtInternalDerive, Derive };
