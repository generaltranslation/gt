import { VisitNode } from '@babel/traverse';
import { TransformState } from '../../state/types';
import * as t from '@babel/types';
import { isReactJsxFunction } from '../../utils/constants/resolveIdentifier/isReactJsxFunction';

/**
 * This needs to handle the insertion of the T and Var components into the Jsx tree.
 *
 *
 * Rules:
 * - Insert the T component at the first level that contains translatable content
 * <div>
 *   <!-- Translatable content so insert here -->
 *   <button>Click me</button>
 *   Hello World
 *   <p>This is a paragraph</p>
 *   <!-- End of translatable content -->
 * </div>
 *
 * - Insert a Var component surrounding any dynamic content
 * <div>
 *   <button>Click me</button>
 *   Hello World
 *   <p>This is a {dynamicContent}</p> <-- Insert a Var component surrounding the curly braces content
 * </div>
 *
 * - If there is already a T component, do not insert a new one wrapping it or any of its children
 * <div>
 *   <T>
 *     <button>Click me</button>
 *     Hello World
 *     <p>This is a <Var>{dynamicContent}</Var></p>
 *   </T>
 *
 *   <!-- Insert a separate T component here -->
 *   Hello World
 *   <p>This is a paragraph</p>
 *   <!-- End of translatable content -->
 * </div>
 *
 * - For Branches and Plurals, don't insert the T component in the branches, insert the T at the parent as if the Branch/Plural itself was translatable content.
 * Remember, the T component can translate content in branches and plural arguments.
 * <div>
 *   <!-- Translatable content so insert here -->
 *   <Branch
 *     branch="summary"
 *     summary={<p>This is a summary</p>}
 *     details={<p>This is a details</p>}
 *   >
 *     <p>This is a fallback</p>
 *   </Branch>
 *   <!-- End of translatable content -->
 * </div>
 */
export function processCallExpression(
  state: TransformState
): VisitNode<t.Node, t.CallExpression> {
  return {
    enter: (path) => {
      // Return if not a JSX function
      const calleePath = path.get('callee');
      if (
        (!calleePath.isIdentifier() && !calleePath.isMemberExpression()) ||
        !isReactJsxFunction(calleePath)
      ) {
        return;
      }
    },
    exit: (path) => {},
  };
}
