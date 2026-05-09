import React, { ReactNode } from 'react';
import getVariableProps, {
  isVariableElementProps,
} from '../variables/_getVariableProps';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import getPluralBranch from '../branches/plurals/getPluralBranch';
import {
  RenderVariable,
  TaggedChild,
  TaggedChildren,
  TaggedElement,
} from '../types-dir/types';
import getGTTag from './getGTTag';

export default function renderDefaultChildren({
  children,
  defaultLocale = libraryDefaultLocale,
  renderVariable,
}: {
  children: TaggedChildren;
  defaultLocale: string;
  renderVariable: RenderVariable;
}): React.ReactNode {
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
        injectionType,
      });
    }

    // Plural
    if (generaltranslation?.transformation === 'plural') {
      const branches = generaltranslation.branches || {};
      if (typeof child.props.n !== 'number') {
        return child.props.children != null
          ? handleChildren(child.props.children)
          : null;
      }
      return handleChildren(
        (getPluralBranch(child.props.n, [defaultLocale], branches) ||
          child.props.children) as TaggedChildren
      );
    }

    // Branch
    if (generaltranslation?.transformation === 'branch') {
      const { children, branch } = child.props;
      const branches = generaltranslation.branches || {};
      return handleChildren(
        branch && branches[branch] !== undefined ? branches[branch] : children
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
    return React.cloneElement(child, { ...child.props, 'data-_gt': undefined });
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
}
