/**
 * The `<Branch>` component dynamically renders a specified branch of content or a fallback child component.
 * It allows for flexible content switching based on the `branch` prop and an object of possible branches (`...branches`).
 * If the specified `branch` is present in the `branches` object, it renders the content of that branch.
 * If the `branch` is not found, it renders the provided `children` as fallback content.
 *
 * @example
 * ```jsx
 * <Branch
 *  branch={user.gender}
 *  female={<p>She is happy.</p>}
 *  male={<p>He is happy.</p>}
 * >
 *   <p>They are happy.</p>
 * </Branch>
 * ```
 * If the `branch` prop is set to `"male"`, it will render `<p>He is happy.</p>`. If the `branch` is set to "female" it will render `<p>She is happy.</p>`. If the gender is not set or does not match any props, it renders the fallback content `<p>Fallback content</p>`.
 *
 * @param {any} [children] - Fallback content to render if no matching branch is found.
 * @param {string} [name="branch"] - Optional name for the component, used for metadata or tracking purposes.
 * @param {string} [branch] - The name of the branch to render. The component looks for this key in the `...branches` object.
 * @param {object} [branches] - An object containing possible branches as keys and their corresponding content as values.
 * @returns {JSX.Element} The rendered branch or fallback content.
 */
function Branch({
  children,
  name = 'branch',
  branch,
  ...props
}: {
  children?: any;
  name?: string;
  branch?: string;
  [key: string]: any;
}) {
  const { 'data-_gt': generaltranslation, ...branches } = props;
  const renderedBranch =
    branch && typeof branches[branch] !== 'undefined'
      ? branches[branch]
      : children;
  return (
    <span
      data-_gt={generaltranslation}
      data-_gt-name={name || 'branch'}
      data-_gt-branch-name={branch}
      style={{ display: 'contents' }}
    >
      {renderedBranch}
    </span>
  );
}

Branch.gtTransformation = 'branch';
export default Branch;
