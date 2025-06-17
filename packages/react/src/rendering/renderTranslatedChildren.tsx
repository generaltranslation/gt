import React, { ReactElement, ReactNode } from 'react';
import {
  RenderVariable,
  TaggedChildren,
  TaggedElement,
  TranslatedChildren,
  TranslatedElement,
} from '../types/types';
import isVariableObject from './isVariableObject';
import getGTProp from './getGTProp';
import getVariableProps from '../variables/_getVariableProps';
import renderDefaultChildren from './renderDefaultChildren';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import getPluralBranch from '../branches/plurals/getPluralBranch';
import {
  HTML_CONTENT_PROPS,
  HtmlContentPropValuesRecord,
} from 'generaltranslation/types';

function renderTranslatedElement({
  sourceElement,
  targetElement,
  locales = [libraryDefaultLocale],
  renderVariable,
}: {
  sourceElement: ReactElement<any>;
  targetElement: TranslatedElement;
  locales: string[];
  renderVariable: RenderVariable;
}): React.ReactNode {
  // Get props and generaltranslation
  const { props: sourceProps } = sourceElement;
  const { props: unprocessedTargetProps } = targetElement;
  const sourceGT = sourceProps['data-_gt'];
  const transformation = sourceGT?.['transformation'];

  // Get translated props
  const unprocessedTargetGT = unprocessedTargetProps['data-_gt'];
  const translatedProps: HtmlContentPropValuesRecord = {};
  if (unprocessedTargetGT) {
    Object.entries(HTML_CONTENT_PROPS).forEach(([minifiedName, fullName]) => {
      if (
        unprocessedTargetGT[minifiedName as keyof typeof unprocessedTargetGT]
      ) {
        translatedProps[fullName] = unprocessedTargetGT[
          minifiedName as keyof typeof unprocessedTargetGT
        ] as string;
      }
    });
  }

  // plural (choose a branch)
  if (transformation === 'plural') {
    const n = sourceElement.props.n;
    const sourceBranches = sourceGT.branches || {};
    const sourceBranch =
      getPluralBranch(n, locales, sourceBranches) ||
      sourceElement.props.children;
    const targetBranches = targetElement.props['data-_gt'].branches || {};
    const targetBranch =
      getPluralBranch(n, locales, targetBranches) ||
      targetElement.props.children;
    return renderTranslatedChildren({
      source: sourceBranch,
      target: targetBranch,
      locales,
      renderVariable,
    });
  }

  // branch (choose a branch)
  if (transformation === 'branch') {
    const { branch, children } = sourceProps;
    const sourceBranch = (sourceGT.branches || {})[branch] || children;
    const targetBranch =
      (targetElement.props['data-_gt'].branches || {})[branch] ||
      targetElement.props.children;
    return renderTranslatedChildren({
      source: sourceBranch,
      target: targetBranch as TranslatedChildren,
      locales,
      renderVariable,
    });
  }

  // fragment (create a valid fragment)
  if (transformation === 'fragment' && targetElement.props?.children) {
    return React.createElement(sourceElement.type, {
      key: sourceElement.props.key,
      children: renderTranslatedChildren({
        source: sourceProps.children,
        target: targetElement.props.children,
        locales,
        renderVariable,
      }),
    });
  }

  // other
  if (sourceProps?.children && targetElement.props?.children) {
    return React.cloneElement(sourceElement, {
      ...sourceProps,
      ...translatedProps,
      'data-_gt': undefined,
      children: renderTranslatedChildren({
        source: sourceProps.children,
        target: targetElement.props.children,
        locales,
        renderVariable,
      }),
    });
  }

  // fallback
  return renderDefaultChildren({
    children: sourceElement,
    defaultLocale: locales[0],
    renderVariable,
  });
}

export default function renderTranslatedChildren({
  source,
  target,
  locales = [libraryDefaultLocale],
  renderVariable,
}: {
  source: TaggedChildren;
  target: TranslatedChildren;
  locales: string[];
  renderVariable: RenderVariable;
}): ReactNode {
  // Most straightforward case, return a valid React node
  if ((target === null || typeof target === 'undefined') && source)
    return renderDefaultChildren({
      children: source,
      defaultLocale: locales[0],
      renderVariable,
    });
  if (typeof target === 'string') return target;

  // Convert source to an array in case target has multiple children where source only has one
  if (Array.isArray(target) && !Array.isArray(source) && source)
    source = [source];

  // Multiple children
  if (Array.isArray(source) && Array.isArray(target)) {
    // Track the variables
    const variables: Record<string, any> = {};
    const variablesOptions: Record<string, any> = {};

    // Extract variable props from source elements, and filter out variable elements
    const sourceElements: TaggedElement[] = source.filter(
      (sourceChild): sourceChild is TaggedElement => {
        if (React.isValidElement(sourceChild)) {
          const generaltranslation = getGTProp(sourceChild);
          if (generaltranslation?.transformation === 'variable') {
            const { variableName, variableValue, variableOptions } =
              getVariableProps(sourceChild.props as any);
            variables[variableName] = variableValue;
            variablesOptions[variableName] = variableOptions;
          } else {
            return true;
          }
        }
        return false;
      }
    );

    const findMatchingSourceElement = (
      targetElement: TranslatedElement
    ): TaggedElement | undefined => {
      return (
        sourceElements.find((sourceChild): sourceChild is TaggedElement => {
          const generaltranslation = getGTProp(sourceChild);
          if (typeof generaltranslation?.id !== 'undefined') {
            const sourceId = generaltranslation.id;
            const targetId = targetElement?.props?.['data-_gt']?.id;
            return sourceId === targetId;
          }
          return false;
        }) || sourceElements.shift()
      ); // assumes fixed order, not recommended
    };

    // map target to source
    return target.map((targetChild, index) => {
      if (typeof targetChild === 'string')
        return (
          <React.Fragment key={`string_${index}`}>{targetChild}</React.Fragment>
        );

      // Render variable
      if (isVariableObject(targetChild)) {
        return (
          <React.Fragment key={`var_${index}`}>
            {renderVariable({
              variableType: targetChild.variable || 'variable',
              variableValue: variables[targetChild.key],
              variableOptions: variablesOptions[targetChild.key],
              locales,
            })}
          </React.Fragment>
        );
      }

      // Render element (targetChild is a TranslatedElement)
      const matchingSourceElement = findMatchingSourceElement(
        targetChild as TranslatedElement
      );
      if (matchingSourceElement)
        return (
          <React.Fragment key={`element_${index}`}>
            {renderTranslatedElement({
              sourceElement: matchingSourceElement,
              targetElement: targetChild,
              locales,
              renderVariable,
            })}
          </React.Fragment>
        );
    });
  }

  // Single child
  if (target && typeof target === 'object' && !Array.isArray(target)) {
    const targetType: 'variable' | 'element' = isVariableObject(target)
      ? 'variable'
      : 'element';

    if (React.isValidElement(source)) {
      if (targetType === 'element') {
        return renderTranslatedElement({
          sourceElement: source,
          targetElement: target as TranslatedElement,
          locales,
          renderVariable,
        });
      }

      // Render variable
      const generaltranslation = getGTProp(source);
      if (generaltranslation?.transformation === 'variable') {
        const { variableValue, variableOptions, variableType } =
          getVariableProps(source.props as any);
        return renderVariable({
          variableType,
          variableValue,
          variableOptions,
          locales,
        });
      }
    }
  }

  // fallback
  return renderDefaultChildren({
    children: source,
    defaultLocale: locales[0],
    renderVariable,
  });
}
