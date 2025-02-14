var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
import { jsx as _jsx } from "react/jsx-runtime";
/**
 * The `<Branch>` component dynamically renders a specified branch of content or a fallback child component.
 * It allows for flexible content switching based on the `branch` prop and an object of possible branches (`...branches`).
 * If the specified `branch` is present in the `branches` object, it renders the content of that branch.
 * If the `branch` is not found, it renders the provided `children` as fallback content.
 *
 * @example
 * ```jsx
 * <Branch branch="summary" summary={<p>This is a summary</p>} details={<p>Details here</p>}>
 *   <p>Fallback content</p>
 * </Branch>
 * ```
 * If the `branch` prop is set to `"summary"`, it will render `<p>This is a summary</p>`. If the `branch` is not set or does not match any keys in the branches object, it renders the fallback content `<p>Fallback content</p>`.
 *
 * @param {any} [children] - Fallback content to render if no matching branch is found.
 * @param {string} [name="branch"] - Optional name for the component, used for metadata or tracking purposes.
 * @param {string} [branch] - The name of the branch to render. The component looks for this key in the `...branches` object.
 * @param {object} [branches] - An object containing possible branches as keys and their corresponding content as values.
 * @returns {JSX.Element} The rendered branch or fallback content.
 */
function Branch(_a) {
    var { children, name = 'branch', branch } = _a, props = __rest(_a, ["children", "name", "branch"]);
    const { 'data-_gt': generaltranslation } = props, branches = __rest(props, ['data-_gt']);
    branch = branch === null || branch === void 0 ? void 0 : branch.toString();
    const renderedBranch = branch && typeof branches[branch] !== 'undefined'
        ? branches[branch]
        : children;
    return (_jsx("span", { "data-_gt": generaltranslation, "data-_gt-branch-name": branch, "data-_gt-name": name || 'branch', style: { display: 'contents' }, children: renderedBranch }));
}
Branch.gtTransformation = 'branch';
export default Branch;
