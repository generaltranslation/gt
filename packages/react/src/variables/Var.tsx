import React from 'react';

/**
 * The `<Var>` component renders a variable value, which can either be passed as `children` or a `value`.
 * If `children` is provided, it will be used; otherwise, the `value` is rendered.
 *
 * @example Inline usage:
 * ```jsx
 *  function MyComponent() {
 *     const name = 'Archie';
 *     return (
 *          <T>
 *              <p>
 *                  Hello, <Var> {name} </Var>!
 *              </p>
 *          </T>
 *      );
 *  }
 * ```
 *
 *
 * @param {any} [children] - The content to render inside the component. If provided, it will take precedence over `value`.
 * @returns {JSX.Element} The rendered variable component with either `children` or `value`.
 */
function Var({
  children,
}: {
  children?: any;
  name?: string;
}): React.JSX.Element | null {
  return <>{children}</>;
}

/** @internal _gtt - The GT transformation for the component. */
Var._gtt = 'variable-variable';

export default Var;
