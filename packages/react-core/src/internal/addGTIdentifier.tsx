import React, { ReactElement, isValidElement, ReactNode } from 'react';
import { isAcceptedPluralForm } from 'generaltranslation/internal';
import {
  GTTag,
  TaggedChild,
  TaggedChildren,
  TaggedElement,
  TaggedElementProps,
} from '../types-dir/types';
import {
  Transformation,
  TransformationPrefix,
  VariableTransformationSuffix,
} from 'generaltranslation/types';

export default function addGTIdentifier(
  children: ReactNode,
  startingIndex: number = 0
): TaggedChildren {
  // Object to keep track of the current index for GT IDs
  let index = startingIndex;

  /**
   * Function to create a GTTag object for a ReactElement
   * @param child - The ReactElement for which the GTTag is created
   * @returns - The GTTag object
   */
  const createGTTag = (child: ReactElement<any>): GTTag => {
    const { type, props } = child;
    index += 1;
    const result: GTTag = { id: index };
    let transformation: Transformation | undefined;
    try {
      transformation =
        typeof type === 'function' ? (type as any)._gtt || '' : '';
    } catch {
      /* empty */
    }
    if (transformation) {
      const transformationParts = transformation.split('-');
      if (transformationParts[0] === 'translate') {
        // Convert nested <T> to fragments
        // This will nullify translation specific attributes of child, i.e. id, context, etc.
        transformationParts[0] = 'fragment';
      }
      if (transformationParts[0] === 'variable') {
        result.variableType =
          (transformationParts?.[1] as VariableTransformationSuffix) ||
          'variable';
      }
      if (transformationParts[0] === 'plural') {
        const pluralBranches = Object.entries(props).reduce(
          (acc, [branchName, branch]) => {
            if (isAcceptedPluralForm(branchName)) {
              (acc as Record<string, TaggedChildren>)[branchName] =
                addGTIdentifier(branch as ReactNode, index);
            }
            return acc;
          },
          {}
        );
        if (Object.keys(pluralBranches).length)
          result.branches = pluralBranches;
      }
      if (transformationParts[0] === 'branch') {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
        const { children, branch, ...branches } = props;
        const resultBranches = Object.entries(branches).reduce(
          (acc, [branchName, branch]) => {
            (acc as Record<string, TaggedChildren>)[branchName] =
              addGTIdentifier(branch as ReactNode, index);
            return acc;
          },
          {}
        );
        if (Object.keys(resultBranches).length)
          result.branches = resultBranches;
      }
      result.transformation = transformationParts[0] as TransformationPrefix;
    }
    return result;
  };

  function handleSingleChildElement(child: ReactElement<any>): TaggedElement {
    const { props } = child;

    // Create new props for the element, including the GT identifier and a key
    const generaltranslation: GTTag = createGTTag(child);
    const newProps: TaggedElementProps = {
      ...props,
      'data-_gt': generaltranslation,
    };
    if (props.children && !generaltranslation.variableType) {
      newProps.children = handleChildren(props.children as ReactNode);
    }
    if (child.type === React.Fragment) {
      newProps['data-_gt'].transformation = 'fragment';
    }
    return React.cloneElement(child, newProps) as TaggedElement;
  }

  function handleSingleChild(child: ReactNode): TaggedChild {
    if (isValidElement(child)) {
      return handleSingleChildElement(child);
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
