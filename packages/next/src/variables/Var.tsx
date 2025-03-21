import React from 'react';

/**
 * The `<Var>` component renders a variable value, which can either be passed as `children` or a `value`.
 * If `children` is provided, it will be used; otherwise, the `value` is rendered.
 *
 * @example
 * ```jsx
 * <Var
 *    name="username"
 * >
 *    John
 * </Var>
 * ```
 *
 * @param {any} [children] - The content to render inside the component. If provided, it will take precedence over `value`.
 * @param {string} [name] - Optional name for the variable, used for metadata purposes.
 * @param {any} [value] - The default value to be displayed if `children` is not provided.
 * @returns {JSX.Element} The rendered variable component with either `children` or `value`.
 */
function Var({
  children,
  name,
  value,
  ...props
}: {
  children?: any;
  name?: string;
  value?: any;
  'data-_gt'?: any;
}): React.JSX.Element {
  const { 'data-_gt': generaltranslation } = props;

  if (typeof children !== 'undefined' && typeof value === 'undefined')
    value = children;

  // return (
  //   <span
  //     data-_gt={generaltranslation}
  //     data-_gt-variable-name={name}
  //     data-_gt-variable-type={'variable'}
  //     style={{ display: 'contents' }}
  //     suppressHydrationWarning
  //   >
  //     {value}
  //   </span>
  return <React.Fragment>{value}</React.Fragment>;
}

Var.gtTransformation = 'variable-variable'; // keep this because Var is imported in other functions

export default Var;
