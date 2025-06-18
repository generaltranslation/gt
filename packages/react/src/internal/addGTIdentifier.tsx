import React, { ReactElement, isValidElement, ReactNode } from 'react';
import { isAcceptedPluralForm } from 'generaltranslation/internal';
import {
  createNestedDataGTError,
  createNestedTError,
} from '../errors/createErrors';
import {
  TaggedChild,
  TaggedChildren,
  TaggedElement,
  TaggedElementProps,
} from '../types/types';
import {
  GTProp,
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
   * Function to create a GTProp object for a ReactElement
   * @param child - The ReactElement for which the GTProp is created
   * @returns - The GTProp object
   */
  const createGTProp = (child: ReactElement<any>): GTProp => {
    const { type, props } = child;
    index += 1;
    const result: GTProp = { id: index };
    let transformation: Transformation | undefined;
    try {
      transformation =
        typeof type === 'function' ? (type as any).gtTransformation || '' : '';
    } catch {
      /* empty */
    }
    if (transformation) {
      const transformationParts = transformation.split('-');
      if (transformationParts[0] === 'translate') {
        // TODO: turn transformation into a fragment here
        throw new Error(createNestedTError(child));
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
              (acc as Record<string, any>)[branchName] = addGTIdentifier(
                branch as ReactNode,
                index
              );
            }
            return acc;
          },
          {}
        );
        if (Object.keys(pluralBranches).length) result.b = pluralBranches;
      }
      if (transformationParts[0] === 'branch') {
        const { children, branch, ...branches } = props;
        const resultBranches = Object.entries(branches).reduce(
          (acc, [branchName, branch]) => {
            (acc as Record<string, any>)[branchName] = addGTIdentifier(
              branch as ReactNode,
              index
            );
            return acc;
          },
          {}
        );
        if (Object.keys(resultBranches).length) result.b = resultBranches;
      }
      result.t = transformationParts[0] as TransformationPrefix;
    }
    return result;
  };

  function handleSingleChildElement(child: ReactElement<any>): TaggedElement {
    const { props } = child;

    if (props['data-_gt']) throw new Error(createNestedDataGTError(child));
    // Create new props for the element, including the GT identifier and a key
    const generaltranslation: GTProp = createGTProp(child);
    const newProps: TaggedElementProps = {
      ...props,
      'data-_gt': generaltranslation,
    };
    if (props.children && !generaltranslation.variableType) {
      newProps.children = handleChildren(props.children as ReactNode);
    }
    if (child.type === React.Fragment) {
      newProps['data-_gt'].t = 'fragment';
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
