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
      const { variableType, variableValue, variableOptions } = getVariableProps(
        child.props
      );
      return renderVariable({
        variableType,
        variableValue,
        variableOptions,
        locales: [defaultLocale],
      });
    }

    // Plural
    if (generaltranslation?.transformation === 'plural') {
      const branches = generaltranslation.branches || {};
      return handleChildren(
        getPluralBranch(child.props.n, [defaultLocale], branches) ||
          child.props.children
      );
    }

    // Branch
    if (generaltranslation?.transformation === 'branch') {
      // eslint-disable-next-line prefer-const, @typescript-eslint/no-unused-vars, no-unused-vars
      let { children, branch, 'data-_gt': _gt, ...branches } = child.props;
      branches = generaltranslation.branches || {};
      return handleChildren(
        branches[branch] !== undefined ? branches[branch] : children
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
        children: handleChildren(child.props.children),
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
