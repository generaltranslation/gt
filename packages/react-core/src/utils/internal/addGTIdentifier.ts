import React, { ReactElement, isValidElement, ReactNode } from 'react';
import {
  getPluralBranchKey,
  isAcceptedPluralForm,
  Transformation,
  TransformationPrefix,
  VariableTransformationSuffix,
} from 'generaltranslation/internal';
import { fillCount } from '../plurals/fillCount';
import { reportMissingCount } from '../plurals/getPluralBranch';
import {
  GTTag,
  TaggedChild,
  TaggedChildren,
  TaggedElement,
  TaggedElementProps,
} from '../types';

type GTComponentType = {
  _gtt?: Transformation;
};

export function addGTIdentifier(
  children: ReactNode,
  startingIndex: number = 0
): TaggedChildren {
  // Object to keep track of the current index for GT IDs
  let index = startingIndex;

  // The children of a <Plural> or a <Branch> are its `other` branch.
  const addFallbackBranch = (
    branches: Record<string, TaggedChildren>,
    children: unknown
  ) => {
    if (children !== undefined)
      branches.other = addGTIdentifier(children as ReactNode, index);
  };

  /**
   * Function to create a GTTag object for a ReactElement
   * @param child - The ReactElement for which the GTTag is created
   * @returns - The GTTag object
   */
  const createGTTag = (child: ReactElement<Record<string, unknown>>): GTTag => {
    const { type, props } = child;
    index += 1;
    const result: GTTag = { id: index, injectionType: 'manual' };
    let transformation: Transformation | undefined;
    try {
      transformation =
        typeof type === 'function' ? (type as GTComponentType)._gtt : undefined;
    } catch {
      /* empty */
    }
    if (transformation) {
      const transformationParts = transformation.split('-');
      // If the component was inserted automatically by the compiler
      if (
        transformationParts[1] === 'automatic' ||
        transformationParts[2] === 'automatic'
      ) {
        result.injectionType = 'automatic';
      }

      if (transformationParts[0] === 'translate') {
        // Convert nested <T> to fragments
        // This will nullify translation specific attributes of child, i.e. id, context, etc.
        transformationParts[0] = 'fragment';
      }
      if (transformationParts[0] === 'variable') {
        result.variableType =
          (transformationParts?.[1] as VariableTransformationSuffix) ||
          'variable';
        // A plural fills its branches before they are tagged.
        if (result.variableType === 'count' && props.children == null) {
          reportMissingCount();
        }
      }
      if (transformationParts[0] === 'plural') {
        const pluralBranches = Object.entries(props).reduce(
          (acc, [branchName, branch]) => {
            if (isAcceptedPluralForm(branchName)) {
              (acc as Record<string, TaggedChildren>)[
                getPluralBranchKey(branchName)
              ] = addGTIdentifier(
                fillCount(branch as ReactNode, props.n),
                index
              );
            }
            return acc;
          },
          {} as Record<string, TaggedChildren>
        );
        addFallbackBranch(
          pluralBranches,
          fillCount(props.children as ReactNode, props.n)
        );
        if (Object.keys(pluralBranches).length)
          result.branches = pluralBranches;
      }
      if (transformationParts[0] === 'branch') {
        const { children, branch: _branch, other: _other, ...branches } = props;
        // Filter out data-* attributes injected by build tools
        const filteredBranches = Object.fromEntries(
          Object.entries(branches).filter(([key]) => !key.startsWith('data-'))
        );
        const resultBranches = Object.entries(filteredBranches).reduce(
          (acc, [branchName, branch]) => {
            (acc as Record<string, TaggedChildren>)[branchName] =
              addGTIdentifier(branch as ReactNode, index);
            return acc;
          },
          {} as Record<string, TaggedChildren>
        );
        addFallbackBranch(resultBranches, children);
        if (Object.keys(resultBranches).length)
          result.branches = resultBranches;
      }
      result.transformation = transformationParts[0] as TransformationPrefix;
    }
    return result;
  };

  function handleSingleChildElement(
    child: ReactElement<Record<string, unknown>>
  ): TaggedElement {
    const { props } = child;

    // Create new props for the element, including the GT identifier and a key
    const generaltranslation: GTTag = createGTTag(child);
    const newProps: TaggedElementProps = {
      ...props,
      'data-_gt': generaltranslation,
    };
    if (
      generaltranslation.transformation === 'plural' ||
      generaltranslation.transformation === 'branch'
    ) {
      // Stored as the `other` branch above.
      newProps.children = undefined;
    } else if (props.children && !generaltranslation.variableType) {
      newProps.children = handleChildren(props.children as ReactNode);
    }
    if (child.type === React.Fragment) {
      newProps['data-_gt'].transformation = 'fragment';
    }
    return React.cloneElement(child, newProps) as TaggedElement;
  }

  function handleSingleChild(child: ReactNode): TaggedChild {
    if (isValidElement(child)) {
      return handleSingleChildElement(
        child as ReactElement<Record<string, unknown>>
      );
    }
    return child;
  }

  function handleChildren(children: ReactNode): TaggedChildren {
    if (Array.isArray(children)) {
      return React.Children.map(children, handleSingleChild);
    } else {
      return handleSingleChild(children);
    }
  }

  return handleChildren(children);
}
