import { ReactNode } from 'react';

/**
 * `<Derive>` marks its children as statically analyzable for the compiler and CLI tool.
 *
 * This is the i18n-context version — does not use React Context.
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
GtInternalDerive._gtt = 'derive-injected';

export { GtInternalDerive, Derive };
