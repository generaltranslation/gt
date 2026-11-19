import {
  GTProp,
  HtmlContentPropKeysRecord,
  HTML_CONTENT_PROPS,
  JsxChild,
  JsxChildren,
} from '@generaltranslation/format';
import {
  defaultVariableNames,
  getVariableName,
  minifyVariableType,
} from '../../../utils/getVariableName.js';
import {
  getPluralBranchKey,
  isAcceptedPluralForm,
} from 'generaltranslation/internal';
import { MultipliedTreeNode } from './types.js';
import {
  DATA_ATTR_PREFIX,
  BRANCH_COMPONENT,
  PLURAL_COMPONENT,
} from '../constants.js';

// The children of a <Plural> or a <Branch> are its `other` branch.
function addFallbackBranch(
  branches: Record<string, JsxChildren>,
  children: unknown,
  id: number,
  gtVariableNames?: Set<string>
): void {
  if (children === undefined) return;
  const fallback = addGTIdentifierToSyntaxTree(
    children as MultipliedTreeNode,
    id,
    gtVariableNames
  );
  if (fallback) branches.other = fallback;
}

/**
 * Construct the data-_gt prop
 * @param type - The type of the element
 * @param props - The props of the element
 * @param id - The id of the element
 * @returns The data-_gt prop
 */
function constructGTProp(
  type: string,
  props: Record<string, unknown>,
  id: number,
  gtVariableNames?: Set<string>
): GTProp | undefined {
  // Add translatable HTML content props
  const generaltranslation: GTProp = Object.entries(
    HTML_CONTENT_PROPS
  ).reduce<GTProp>((acc, [minifiedName, fullName]) => {
    const value = props[fullName];
    if (typeof value === 'string') {
      acc[minifiedName as keyof HtmlContentPropKeysRecord] = value;
    }
    return acc;
  }, {});

  // Plural
  if (type === PLURAL_COMPONENT) {
    const pluralBranches = Object.entries(props).reduce(
      (acc: Record<string, JsxChildren>, [branchName, branch]) => {
        if (isAcceptedPluralForm(branchName)) {
          acc[getPluralBranchKey(branchName)] = addGTIdentifierToSyntaxTree(
            branch as MultipliedTreeNode,
            id
          );
        }
        return acc;
      },
      {}
    );
    addFallbackBranch(pluralBranches, props.children, id, gtVariableNames);
    // Add plural branches to the generaltranslation
    if (Object.keys(pluralBranches).length) {
      generaltranslation.t = 'p';
      generaltranslation.b = pluralBranches;
    }

    // Branch
  } else if (type === BRANCH_COMPONENT) {
    const { children, branch: _branch, other: _other, ...allBranches } = props;
    // Filter out data-* attributes injected by build tools
    const branches = Object.fromEntries(
      Object.entries(allBranches).filter(
        ([key]) => !key.startsWith(DATA_ATTR_PREFIX)
      )
    );
    const resultBranches = Object.entries(branches).reduce(
      (acc: Record<string, JsxChildren>, [branchName, branch]) => {
        acc[branchName] = addGTIdentifierToSyntaxTree(
          branch as MultipliedTreeNode,
          id
        );
        return acc;
      },
      {}
    );
    addFallbackBranch(resultBranches, children, id, gtVariableNames);
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
  tree: MultipliedTreeNode,
  startingIndex = 0,
  gtVariableNames?: Set<string>
): JsxChildren {
  // Edge case: boolean or null, just return the tree
  if (typeof tree === 'boolean' || tree === null) {
    return tree as unknown as JsxChild;
  }

  // Object to keep track of the current index for GT IDs
  const indexObject: { index: number } = { index: startingIndex };

  /**
   * Handle a single child
   * @param child - The child to handle
   * @returns The handled child
   */
  const handleSingleChild = (child: MultipliedTreeNode): JsxChild => {
    // Handle JSX elements
    if (child && typeof child === 'object') {
      let { type } = child;
      const { props } = child;
      indexObject.index += 1;

      // Handle fragments
      if (type === 'React.Fragment') {
        type = '';
      }

      // Variables — only treat as GT variable if confirmed as GT import
      const isGTVariable = gtVariableNames
        ? gtVariableNames.has(type)
        : Object.keys(defaultVariableNames).includes(type);
      if (isGTVariable) {
        const variableType = minifyVariableType(
          type as keyof typeof defaultVariableNames
        );
        const variableName = getVariableName(
          props,
          type as keyof typeof defaultVariableNames,
          indexObject.index
        );
        return {
          i: indexObject.index,
          k: variableName,
          v: variableType,
        };
      }

      // Construct the data-_gt prop
      const generaltranslation = constructGTProp(
        type as string,
        (props || {}) as Record<string, unknown>,
        indexObject.index,
        gtVariableNames
      );

      // Save current index and recurse. The children of a Branch or a Plural
      // are a branch, constructed above.
      const currentIndex = indexObject.index;
      const children =
        type === PLURAL_COMPONENT || type === BRANCH_COMPONENT
          ? false
          : handleChildren(
              props?.children === undefined ? null : props?.children
            );

      // Enforce boolean rendering behavior
      // <T>{true}</T> -> true <- this is a boolean value, not a string
      // <T>{false}</T> -> nothing
      let includeChildren = true;
      if (typeof children === 'boolean') {
        // So, technically JsxChildren do include boolean values, but the type is incorrect
        includeChildren = children !== false;
      }

      // Return the result
      return {
        t: type || `C${currentIndex}`,
        i: currentIndex,
        ...(includeChildren && { c: children }),
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
  const handleChildren = (children: MultipliedTreeNode): JsxChildren => {
    return Array.isArray(children)
      ? children.map(handleSingleChild).filter((child) => {
          // Enforce boolean rendering behavior
          // <T>{true}{false}{null}</T> -> []
          if (
            typeof child === 'boolean' ||
            child === null ||
            child === undefined
          ) {
            return false;
          }
          return true;
        })
      : handleSingleChild(children);
  };

  return handleChildren(tree);
}
