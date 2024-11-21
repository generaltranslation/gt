import React, { ReactElement, ReactNode } from 'react';
import renderVariable from './renderVariable';
import { getPluralBranch, getVariableProps } from 'gt-react/internal';
import { primitives } from 'gt-react/internal';

// Renders the children in the default locale, as they are supplied
// with variables substituted (for use by the dictionary)
export default function renderDefaultChildren({
  children,
  variables = {},
  variablesOptions = {},
  defaultLocale = primitives.libraryDefaultLocale,
}: {
  children: ReactElement;
  variables?: Record<string, any>;
  variablesOptions?: Record<string, any>;
  defaultLocale: string;
}) {
  const handleSingleChild = (child: ReactNode) => {
    if (React.isValidElement(child)) {
      const { 'data-_gt': generaltranslation, ...props } = child.props;
      if (generaltranslation?.transformation === 'variable') {
        let { variableName, variableType, variableValue, variableOptions } =
          getVariableProps(child.props); // needs both regular props and data-_gt
        variableValue =
          typeof variables[variableName] !== 'undefined'
            ? variables[variableName]
            : variableValue;
        return renderVariable({
          variableName,
          variableType,
          variableValue,
          variableOptions: {
            ...variablesOptions[variableName],
            ...variableOptions,
          },
        });
      }
      if (generaltranslation?.transformation === 'plural') {
        const n =
          typeof variables.n === 'number'
            ? variables.n
            : typeof props.n === 'number'
            ? props.n
            : props['data-_gt-n'];
        const branches = generaltranslation.branches || {};
        return handleChildren(
          getPluralBranch(n, [defaultLocale], branches) || child.props.children
        );
      }
      if (generaltranslation?.transformation === 'branch') {
        let { children, name, branch, 'data-_gt': _gt, ...branches } = props;
        name = name || props['data-_gt-name'] || 'branch';
        branch =
          variables[name] || branch || child.props['data-_gt-branch-name'];
        branches = generaltranslation.branches || {};
        return handleChildren(
          branches[branch] !== undefined ? branches[branch] : children
        );
      }
      if (child.props.children) {
        return React.cloneElement(child, {
          ...props,
          'data-_gt': undefined,
          children: handleChildren(child.props.children),
        });
      }
      return React.cloneElement(child, { ...props, 'data-_gt': undefined });
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
