import React, { ReactNode } from 'react';
import {
  getVariableProps,
  isVariableElementProps,
} from '../variables/_getVariableProps';
import { defaultDefaultLocale } from '@generaltranslation/format/internal';
import { TaggedChild, TaggedChildren, TaggedElement } from '../types';
import { getGTTag } from './getGTTag';
import { getBranch, getPluralBranch } from '../plurals/getPluralBranch';
import type { RenderVariable } from '../types';

// Shared implementation: the variable renderer is dependency-injected by a
// factory so this module statically imports no variable components.
// Callsites use the pre-instantiated renderPipeline.rsc module instead of
// importing this directly.

type RenderDefaultChildrenArgs = {
  children: TaggedChildren;
  defaultLocale: string;
  enableI18n: boolean;
};

export type { RenderDefaultChildrenArgs };

function createRenderDefaultChildren({
  renderVariable,
}: {
  renderVariable: RenderVariable;
}): (args: RenderDefaultChildrenArgs) => React.ReactNode {
  return function renderDefaultChildren({
    children,
    defaultLocale = defaultDefaultLocale,
    enableI18n,
  }: RenderDefaultChildrenArgs): React.ReactNode {
    const handleSingleChildElement = (child: TaggedElement): ReactNode => {
      const generaltranslation = getGTTag(child);

      // Variable
      if (isVariableElementProps(child.props)) {
        const { variableType, variableValue, variableOptions, injectionType } =
          getVariableProps(child.props);
        return renderVariable({
          variableType,
          variableValue,
          variableOptions,
          locales: [defaultLocale],
          enableI18n,
          injectionType,
        });
      }

      // Plural
      if (generaltranslation?.transformation === 'plural') {
        return handleChildren(
          getPluralBranch(
            child.props.n,
            [defaultLocale],
            generaltranslation.branches || {}
          )
        );
      }

      // Branch
      if (generaltranslation?.transformation === 'branch') {
        return handleChildren(
          getBranch(child.props.branch, generaltranslation.branches || {})
        );
      }

      // Fragment
      if (generaltranslation?.transformation === 'fragment') {
        return React.createElement(React.Fragment, {
          key: child.props.key,
          children: handleChildren(child.props.children),
        });
      }

      // Default
      if (child.props.children) {
        return React.cloneElement(child, {
          ...child.props,
          'data-_gt': undefined,
          children: handleChildren(child.props.children) as TaggedChildren,
        });
      }
      return React.cloneElement(child, {
        ...child.props,
        'data-_gt': undefined,
      });
    };

    const handleSingleChild = (child: TaggedChild): ReactNode => {
      if (React.isValidElement(child)) {
        return handleSingleChildElement(child);
      }
      return child;
    };

    const handleChildren = (children: TaggedChildren): ReactNode => {
      return Array.isArray(children)
        ? React.Children.map(children, handleSingleChild)
        : handleSingleChild(children);
    };

    return handleChildren(children);
  };
}

export { createRenderDefaultChildren };
