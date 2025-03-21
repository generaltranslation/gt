import React, { ReactElement, ReactNode } from 'react';
import getGTProp from '../helpers/getGTProp';
import getVariableProps from '../../variables/_getVariableProps';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import getPluralBranch from '../../branches/plurals/getPluralBranch';
import { RenderVariable } from '../../types/types';

export default function renderDefaultChildren({
  children,
  defaultLocale = libraryDefaultLocale,
  renderVariable,
}: {
  children: ReactNode;
  defaultLocale: string;
  renderVariable: RenderVariable;
}): React.ReactNode {
  const handleSingleChildElement = (child: ReactElement<any>) => {
    const generaltranslation = getGTProp(child);
    if (generaltranslation?.transformation === 'variable') {
      const { variableType, variableValue, variableOptions } = getVariableProps(
        child.props as any
      );
      return renderVariable({
        variableType,
        variableValue,
        variableOptions,
        locales: [defaultLocale],
      });
    }
    if (generaltranslation?.transformation === 'plural') {
      const branches = generaltranslation.branches || {};
      return handleChildren(
        getPluralBranch(child.props.n, [defaultLocale], branches) ||
          child.props.children
      );
    }
    if (generaltranslation?.transformation === 'branch') {
      let {
        children,
        name,
        branch,
        'data-_gt': _gt,
        ...branches
      } = child.props;
      name = name || child.props['data-_gt-name'] || 'branch';
      branches = generaltranslation.branches || {};
      return handleChildren(
        branches[branch] !== undefined ? branches[branch] : children
      );
    }
    if (generaltranslation?.transformation === 'fragment') {
      return React.createElement(child.type, {
        key: child.props.key,
        children: handleChildren(child.props.children),
      });
    }
    if (child.props.children) {
      return React.cloneElement(child, {
        ...child.props,
        'data-_gt': undefined,
        children: handleChildren(child.props.children),
      });
    }
    return React.cloneElement(child, { ...child.props, 'data-_gt': undefined });
  };

  const handleSingleChild = (child: ReactNode) => {
    if (React.isValidElement<any>(child)) {
      return handleSingleChildElement(child);
    }
    return child;
  };

  const handleChildren = (children: ReactNode): ReactNode => {
    return Array.isArray(children)
      ? React.Children.map(children, handleSingleChild)
      : handleSingleChild(children);
  };

  return handleChildren(children);
}
