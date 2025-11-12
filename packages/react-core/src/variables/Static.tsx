import React from 'react';

/**
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
 * @param {T extends React.ReactNode} children - Static content to render.
 * @returns {T} The result of the function invocation.
 */
export function Static<T extends React.ReactNode>({
  children,
}: {
  children: T;
}): T {
  return children;
}

/**
 * declareStatic() is a powerful but dangerous function which marks its argument as statically analyzable for the compiler and CLI tool.
 *
 * This function is dangerous because it can cause the compiler and CLI tool to throw an error if the argument is not statically analyzable.
 *
 * @example
 * ```jsx
 * function getSubject() {
 *   return (Math.random() > 0.5) ? "Alice" : "Brian";
 * }
 * ...
 * gt("My name is {declareStatic(getSubject())}");
 * ```
 *
 * @param {T extends string | null | undefined} string - String returning function invocation to declare as static.
 * @returns {T} The result of the function invocation.
 */
export function declareStatic<T extends string | null | undefined>(
  string: T
): T {
  return string;
}
