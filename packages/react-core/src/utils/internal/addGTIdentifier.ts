import React, { ReactElement, isValidElement, ReactNode } from 'react';
import {
  getPluralBranchKey,
  isAcceptedPluralForm,
} from 'generaltranslation/internal';
import { getMarker } from '../marker';
import { fillCount } from '../plurals/fillCount';
import { isCount, reportMissingCount } from '../plurals/getPluralBranch';
import {
  GTTag,
  TaggedChild,
  TaggedChildren,
  TaggedElement,
  TaggedElementProps,
} from '../types';
import { COUNT_VARIABLE_TYPE } from '../variables/_getVariableProps';

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
    const marker = getMarker(type);
    const tag = {
      id: index,
      injectionType: marker?.automatic ? 'automatic' : 'manual',
    } as const;
    if (!marker) {
      return type === React.Fragment
        ? { ...tag, transformation: 'fragment' }
        : tag;
    }
    switch (marker.kind) {
      case 'translate':
        // A nested <T> is a fragment, which drops its id, context and so on.
        return { ...tag, transformation: 'fragment' };
      case 'derive':
        return { ...tag, transformation: 'derive' };
      case 'variable':
        // A plural fills its branches before they are tagged.
        if (
          marker.variableType === COUNT_VARIABLE_TYPE &&
          props._count === undefined
        ) {
          reportMissingCount();
        }
        return {
          ...tag,
          transformation: 'variable',
          variableType: marker.variableType,
        };
      case 'plural':
      case 'ordinal': {
        const { n } = props;
        const fill = (branch: unknown) =>
          isCount(n)
            ? fillCount(branch as ReactNode, n)
            : (branch as ReactNode);
        const pluralBranches = Object.entries(props).reduce(
          (acc, [branchName, branch]) => {
            if (isAcceptedPluralForm(branchName)) {
              (acc as Record<string, TaggedChildren>)[
                getPluralBranchKey(branchName)
              ] = addGTIdentifier(fill(branch), index);
            }
            return acc;
          },
          {} as Record<string, TaggedChildren>
        );
        addFallbackBranch(pluralBranches, fill(props.children));
        return {
          ...tag,
          transformation: marker.kind,
          ...(Object.keys(pluralBranches).length > 0 && {
            branches: pluralBranches,
          }),
        };
      }
      case 'branch': {
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
        return {
          ...tag,
          transformation: 'branch',
          ...(Object.keys(resultBranches).length > 0 && {
            branches: resultBranches,
          }),
        };
      }
    }
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
      generaltranslation.transformation === 'ordinal' ||
      generaltranslation.transformation === 'branch'
    ) {
      // Stored as the `other` branch above.
      newProps.children = undefined;
    } else if (
      props.children &&
      generaltranslation.transformation !== 'variable'
    ) {
      newProps.children = handleChildren(props.children as ReactNode);
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
