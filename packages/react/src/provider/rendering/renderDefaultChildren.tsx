import React, { ReactElement, ReactNode } from 'react';
import getGTProp from '../helpers/getGTProp';
import getVariableProps from '../../variables/_getVariableProps';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import {
  baseVariablePrefix,
  getFallbackVariableName,
} from '../../variables/getVariableName';
import getPluralBranch from '../../branches/plurals/getPluralBranch';

export default function renderDefaultChildren({
  children,
  variables = {},
  variablesOptions = {},
  defaultLocale = libraryDefaultLocale,
  renderVariable,
}: {
  children: ReactNode;
  variables?: Record<string, any>;
  variablesOptions?: Record<string, any>;
  defaultLocale: string;
  renderVariable: ({
    variableType,
    variableName,
    variableValue,
    variableOptions,
  }: {
    variableType: 'variable' | 'number' | 'datetime' | 'currency';
    variableName: string;
    variableValue: any;
    variableOptions: Intl.NumberFormatOptions | Intl.DateTimeFormatOptions;
    locales: string[];
  }) => React.JSX.Element;
}): React.ReactNode {
  const handleSingleChildElement = (child: ReactElement<any>) => {
    const generaltranslation = getGTProp(child);
    if (generaltranslation?.transformation === 'variable') {
      let { variableName, variableType, variableValue, variableOptions } =
        getVariableProps(child.props as any);
      variableValue = (() => {
        if (typeof variables[variableName] !== 'undefined') {
          return variables[variableName];
        }
        if (typeof variableValue !== 'undefined') return variableValue;
        if (variableName.startsWith(baseVariablePrefix)) {
          // pain point: somewhat breakable logic
          const fallbackVariableName = getFallbackVariableName(variableType);
          if (typeof variables[fallbackVariableName] !== 'undefined') {
            return variables[fallbackVariableName];
          }
        }
        return undefined;
      })();
      variableOptions = {
        ...variablesOptions[variableName],
        ...variableOptions,
      } as Intl.NumberFormatOptions | Intl.DateTimeFormatOptions;
      return renderVariable({
        variableName,
        variableType,
        variableValue,
        variableOptions,
        locales: [defaultLocale],
      });
    }
    if (generaltranslation?.transformation === 'plural') {
      const n =
        typeof variables.n === 'number'
          ? variables.n
          : typeof child.props.n === 'number'
          ? child.props.n
          : child.props['data-_gt-n'];
      if (typeof n === 'number' && typeof variables.n === 'undefined')
        variables.n = n;
      const branches = generaltranslation.branches || {};
      return handleChildren(
        getPluralBranch(n, [defaultLocale], branches) || child.props.children
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
      branch = variables[name] || branch || child.props['data-_gt-branch-name'];
      branches = generaltranslation.branches || {};
      return handleChildren(
        branches[branch] !== undefined ? branches[branch] : children
      );
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
