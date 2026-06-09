import React, { type ReactNode } from 'react';
import getVariableProps, {
  isVariableElementProps,
} from '../variables/_getVariableProps';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import {
  type RenderVariable,
  TaggedChild,
  TaggedChildren,
  TaggedElement,
} from '../types';
import getGTTag from './getGTTag';
import getPluralBranch from '../plurals/getPluralBranch';

export default function renderDefaultChildren({
  children,
  defaultLocale = libraryDefaultLocale,
  enableI18n,
  renderVariable,
}: {
  children: TaggedChildren;
  defaultLocale: string;
  enableI18n: boolean;
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
        enableI18n,
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
      const resolvedBranch = getPluralBranch(
        child.props.n,
        [defaultLocale],
        branches
      );
      return handleChildren(
        (resolvedBranch !== null
          ? resolvedBranch
          : child.props.children) as TaggedChildren
      );
    }

    // Branch
    if (generaltranslation?.transformation === 'branch') {
      const { children, branch } = child.props;
      const branches = generaltranslation.branches || {};
      const branchKey =
        branch == null || branch === '' ? undefined : branch.toString();
      return handleChildren(
        branchKey && branches[branchKey] !== undefined
          ? branches[branchKey]
          : children
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
