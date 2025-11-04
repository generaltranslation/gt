import React from 'react';

/**
 * The `<Static>` component allows you to render the output of a function invocation. Such a function MUST return
 * only static content. If the function returns non-static content, the CLI tool will throw an error.
 *
 * Currently, this feature does not yet support <Suspense>.
 *
 * @example
 * ```jsx
 * function getSubject() {
 *   return 'John';
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
 * @returns {T} The static content.
 */
function Static<T extends React.ReactNode>({ children }: { children: T }): T {
  return children;
}

export default Static;
