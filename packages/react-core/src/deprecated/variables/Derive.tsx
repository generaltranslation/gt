import React from 'react';

/**
 * Marks JSX children as derivable by the GT compiler and CLI.
 *
 * Use `<Derive>` inside translated JSX when child content is computed from
 * source code, but should still be discovered during extraction instead of
 * treated as a runtime interpolation variable. The CLI attempts to resolve the
 * derivable children into every possible static value and includes those values
 * in the source content that gets translated.
 *
 * `<Derive>` renders its children unchanged at runtime.
 *
 * Run `gt validate` after adding or changing `<Derive>` usage to verify that
 * each derivable expression can be resolved by the CLI before translating or
 * building.
 *
 * @example
 * ```jsx
 * function getSubject() {
 *   return (Math.random() > 0.5) ? "Alice" : "Brian";
 * }
 * ...
 * <T>
 *   <Derive>
 *      {getSubject()}
 *   </Derive>
 *   is going to school today.
 * </T>
 * ```
 *
 * @param {T extends React.ReactNode} children - JSX content to derive for translation extraction.
 * @returns {T} The same children, unchanged at runtime.
 */
function Derive<T extends React.ReactNode>({ children }: { children: T }): T {
  return children;
}

/** @internal _gtt - The GT transformation for the component. */
Derive._gtt = 'derive';

export { Derive };
