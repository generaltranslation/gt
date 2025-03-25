import React from 'react';
/**
 * The `<Var>` component renders a variable value, which can either be passed as `children` or a `value`.
 * If `children` is provided, it will be used; otherwise, the `value` is rendered.
 *
 * @example
 * ```jsx
 * <Var>
 *    John
 * </Var>
 * ```
 *
 * @param {any} [children] - The content to render inside the component. If provided, it will take precedence over `value`.
 * @returns {React.JSX.Element} The rendered variable component with either `children` or `value`.
 */
declare function Var({ children, name, }: {
    children?: any;
    name?: string;
}): React.JSX.Element;
declare namespace Var {
    var gtTransformation: string;
}
export default Var;
//# sourceMappingURL=Var.d.ts.map