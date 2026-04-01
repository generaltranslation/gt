import React from 'react';

/**
 * `<Derive>` is a powerful but dangerous component which marks its children as statically analyzable for the compiler and CLI tool.
 *
 * This component is dangerous because it can cause the compiler and CLI tool to throw an error if children are not statically analyzable.
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
 * @param {T extends React.ReactNode} children - Derived content to render.
 * @returns {T} The result of the function invocation.
 */
function Derive<T extends React.ReactNode>({ children }: { children: T }): T {
  return children;
}

/**
 * @deprecated Use `<Derive>` instead.
 *
 * `<Static>` is a powerful but dangerous component which marks its children as statically analyzable for the compiler and CLI tool.
 *
 * This component is dangerous because it can cause the compiler and CLI tool to throw an error if children are not statically analyzable.
 *
 * @example
 * ```jsx
 * function getSubject() {
 *   return (Math.random() > 0.5) ? "Alice" : "Brian";
 * }
 * ...
 * <T>
 *   <Static>
 *      {getSubject()}
 *   </Static>
 *   is going to school today.
 * </T>
 * ```
 *
 * @param {T extends React.ReactNode} children - Derived content to render.
 * @returns {T} The result of the function invocation.
 */
function Static<T extends React.ReactNode>(props: { children: T }): T {
  return Derive(props);
}

/** @internal _gtt - The GT transformation for the component. */
Derive._gtt = 'derive';
Static._gtt = 'derive';

export { Derive, Static };
