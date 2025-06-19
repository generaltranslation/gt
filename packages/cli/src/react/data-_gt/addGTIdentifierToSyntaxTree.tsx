import {
  GTProp,
  HtmlContentPropKeysRecord,
  HTML_CONTENT_PROPS,
  JsxChildren,
} from 'generaltranslation/types';
import {
  defaultVariableNames,
  getVariableName,
  minifyVariableType,
} from '../utils/getVariableName.js';
import { isAcceptedPluralForm, JsxChild } from 'generaltranslation/internal';

/**
 * Construct the data-_gt prop
 * @param type - The type of the element
 * @param props - The props of the element
 * @param id - The id of the element
 * @returns The data-_gt prop
 */
function constructGTProp(
  type: string,
  props: Record<string, any>,
  id: number
): GTProp | undefined {
  // Add translatable HTML content props
  const generaltranslation: GTProp = Object.entries(
    HTML_CONTENT_PROPS
  ).reduce<GTProp>((acc, [minifiedName, fullName]) => {
    if (props[fullName]) {
      acc[minifiedName as keyof HtmlContentPropKeysRecord] = props[fullName];
    }
    return acc;
  }, {});

  // Plural
  if (type === 'Plural') {
    const pluralBranches = Object.entries(props).reduce(
      (acc: Record<string, JsxChildren>, [branchName, branch]) => {
        if (isAcceptedPluralForm(branchName)) {
          acc[branchName] = addGTIdentifierToSyntaxTree(branch, id);
        }
        return acc;
      },
      {}
    );
    // Add plural branches to the generaltranslation
    if (Object.keys(pluralBranches).length) {
      generaltranslation.t = 'p';
      generaltranslation.b = pluralBranches;
    }

    // Branch
  } else if (type === 'Branch') {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
    const { children, branch, ...branches } = props;
    const resultBranches = Object.entries(branches).reduce(
      (acc: Record<string, JsxChildren>, [branchName, branch]) => {
        acc[branchName] = addGTIdentifierToSyntaxTree(branch, id);
        return acc;
      },
      {}
    );
    // Add branches to the generaltranslation
    if (Object.keys(resultBranches).length) {
      generaltranslation.t = 'b';
      generaltranslation.b = resultBranches;
    }
  }

  return Object.keys(generaltranslation).length
    ? generaltranslation
    : undefined;
}

/**
 * Add GT Identifier and minify the tree (recreates addGTIdentifier and writeChildrenAsObjects)
 * @param tree - The tree to add GT identifiers to
 * @param startingIndex - The starting index for GT IDs
 * @returns The tree with GT identifiers added
 */
export default function addGTIdentifierToSyntaxTree(
  tree: any,
  startingIndex = 0
): JsxChildren {
  // Object to keep track of the current index for GT IDs
  const indexObject: { index: number } = { index: startingIndex };

  /**
   * Handle a single child
   * @param child - The child to handle
   * @returns The handled child
   */
  const handleSingleChild = (child: any): JsxChild => {
    // Handle JSX elements
    if (child && typeof child === 'object') {
      let { type } = child;
      const { props } = child;
      indexObject.index += 1;

      // Handle fragments
      if (type === 'React.Fragment') {
        type = '';
      }

      // Variables
      if (Object.keys(defaultVariableNames).includes(type)) {
        const variableType = minifyVariableType(type);
        const variableName = getVariableName(props, type, indexObject.index);
        return {
          v: variableType,
          i: indexObject.index,
          k: variableName,
        };
      }

      // Construct the data-_gt prop
      const generaltranslation = constructGTProp(
        type as string,
        props as Record<string, any>,
        indexObject.index
      );

      // Return the result
      return {
        t: type || `C${indexObject.index}`,
        i: indexObject.index,
        c: handleChildren(props.children),
        ...(generaltranslation && { d: generaltranslation }),
      };
    }
    if (typeof child === 'number') {
      return child.toString();
    }
    return child as JsxChild;
  };

  /**
   * Handle children
   * @param children - The children to handle
   * @returns The handled children
   */
  const handleChildren = (children: any): JsxChildren => {
    return Array.isArray(children)
      ? children.map(handleSingleChild)
      : handleSingleChild(children);
  };

  return handleChildren(tree);
}
