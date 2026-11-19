import React, { ReactNode } from 'react';
import {
  TaggedChildren,
  TaggedElement,
  TranslatedChildren,
  TranslatedElement,
  VariableProps,
} from '../types';
import {
  getVariableProps,
  isVariableElementProps,
} from '../variables/_getVariableProps';
import { createRenderDefaultChildren } from './renderDefaultChildren.shared';
import { isVariable } from 'generaltranslation/internal';
import { defaultDefaultLocale } from '@generaltranslation/format/internal';
import {
  getBranch,
  getPluralBranch,
  selectBranchKey,
  selectPluralKey,
} from '../plurals/getPluralBranch';
import {
  HTML_CONTENT_PROPS,
  HtmlContentPropValuesRecord,
} from '@generaltranslation/format';
import { getGTTag } from './getGTTag';
import type { RenderVariable } from '../types';

// Shared implementation: the variable renderer is dependency-injected by a
// factory so this module statically imports no variable components.
// Callsites use the pre-instantiated renderPipeline.rsc module instead of
// importing this directly.

type RenderTranslatedChildrenArgs = {
  source: TaggedChildren;
  target: TranslatedChildren;
  locales: string[];
  enableI18n: boolean;
};

function createRenderTranslatedChildren({
  renderVariable,
}: {
  renderVariable: RenderVariable;
}): (args: RenderTranslatedChildrenArgs) => ReactNode {
  const renderDefaultChildren = createRenderDefaultChildren({ renderVariable });

  function renderTranslatedElement({
    sourceElement,
    targetElement,
    locales = [defaultDefaultLocale],
    enableI18n,
  }: {
    sourceElement: TaggedElement;
    targetElement: TranslatedElement;
    locales: string[];
    enableI18n: boolean;
  }): React.ReactNode {
    // Get props and generaltranslation
    const { props: sourceProps } = sourceElement;
    const sourceGT = sourceProps['data-_gt'];
    const transformation = sourceGT?.transformation;

    // Get translated props
    const unprocessedTargetGT = targetElement.d;
    const translatedProps: HtmlContentPropValuesRecord = {};
    if (unprocessedTargetGT) {
      Object.entries(HTML_CONTENT_PROPS).forEach(([minifiedName, fullName]) => {
        if (
          unprocessedTargetGT[minifiedName as keyof typeof HTML_CONTENT_PROPS]
        ) {
          translatedProps[fullName] = unprocessedTargetGT[
            minifiedName as keyof typeof HTML_CONTENT_PROPS
          ] as string;
        }
      });
    }

    // The translation chooses a branch; when it has none for the value, the
    // source chooses its own, which then renders untranslated.
    if (transformation === 'plural') {
      const n = sourceElement.props.n;
      const targetBranches = targetElement.d?.b || {};
      const key = selectPluralKey(n, locales, targetBranches);
      const target = targetBranches[key] as TranslatedChildren;
      return renderTranslatedChildren({
        source: getPluralBranch(
          n,
          locales,
          sourceGT.branches || {},
          target === undefined ? undefined : key
        ),
        target,
        locales,
        enableI18n,
      });
    }

    if (transformation === 'branch') {
      const { branch } = sourceProps;
      const targetBranches = targetElement.d?.b || {};
      const key = selectBranchKey(branch, targetBranches);
      const target = targetBranches[key] as TranslatedChildren;
      return renderTranslatedChildren({
        source: getBranch(
          branch,
          sourceGT.branches || {},
          target === undefined ? undefined : key
        ),
        target,
        locales,
        enableI18n,
      });
    }

    // fragment (create a valid fragment)
    if (transformation === 'fragment' && targetElement.c) {
      return React.createElement(React.Fragment, {
        key: sourceElement.props.key,
        children: renderTranslatedChildren({
          source: sourceProps.children as TaggedChildren,
          target: targetElement.c,
          locales,
          enableI18n,
        }) as TaggedChildren,
      });
    }

    // other
    if (sourceProps?.children && targetElement?.c) {
      return React.cloneElement(sourceElement, {
        ...sourceProps,
        ...translatedProps,
        'data-_gt': undefined,
        children: renderTranslatedChildren({
          source: sourceProps.children as TaggedChildren,
          target: targetElement.c,
          locales,
          enableI18n,
        }) as TaggedChildren,
      });
    }

    // fallback
    return renderDefaultChildren({
      children: sourceElement,
      defaultLocale: locales[0],
      enableI18n,
    });
  }

  function renderTranslatedChildren({
    source,
    target,
    locales = [defaultDefaultLocale],
    enableI18n,
  }: RenderTranslatedChildrenArgs): ReactNode {
    // Most straightforward case, return a valid React node
    if ((target === null || typeof target === 'undefined') && source)
      return renderDefaultChildren({
        children: source,
        defaultLocale: locales[0],
        enableI18n,
      });
    if (typeof target === 'string') return target;

    // Convert source to an array in case target has multiple children where source only has one
    if (Array.isArray(target) && !Array.isArray(source) && source)
      source = [source];

    // Multiple children
    if (Array.isArray(source) && Array.isArray(target)) {
      // Track the variables
      const variables: Record<string, VariableProps['variableValue']> = {};
      const variablesOptions: Record<string, VariableProps['variableOptions']> =
        {};
      const variableInjectionTypes: Record<
        string,
        VariableProps['injectionType']
      > = {};

      // Extract source elements
      // Extract variable props
      // Filter out variable elements
      const sourceElements: TaggedElement[] = source.filter(
        (sourceChild): sourceChild is TaggedElement => {
          if (React.isValidElement(sourceChild)) {
            if (isVariableElementProps(sourceChild.props)) {
              const {
                variableName,
                variableValue,
                variableOptions,
                injectionType,
              } = getVariableProps(sourceChild.props);
              variables[variableName] = variableValue;
              variablesOptions[variableName] = variableOptions;
              variableInjectionTypes[variableName] = injectionType;
            } else {
              return true;
            }
          }
          return false;
        }
      );

      // TODO: pre-index these to avoid O(n/2) lookups
      const findMatchingSourceElement = (
        targetElement: TranslatedElement
      ): TaggedElement | undefined => {
        return (
          sourceElements.find((sourceChild): sourceChild is TaggedElement => {
            const generaltranslation = getGTTag(sourceChild);
            if (typeof generaltranslation?.id !== 'undefined') {
              const sourceId = generaltranslation.id;
              const targetId = targetElement.i;
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
            <React.Fragment key={`string_${index}`}>
              {targetChild}
            </React.Fragment>
          );

        // Render variable
        if (isVariable(targetChild)) {
          return (
            <React.Fragment key={`var_${index}`}>
              {renderVariable({
                variableType: targetChild.v || 'v',
                variableValue: variables[targetChild.k],
                variableOptions: variablesOptions[targetChild.k],
                locales,
                enableI18n,
                injectionType:
                  variableInjectionTypes[targetChild.k] || 'manual',
              })}
            </React.Fragment>
          );
        }

        // Render element (targetChild is a TranslatedElement)
        const matchingSourceElement = findMatchingSourceElement(
          targetChild as TranslatedElement
        );
        if (!matchingSourceElement) return null;
        return (
          <React.Fragment key={`element_${index}`}>
            {renderTranslatedElement({
              sourceElement: matchingSourceElement,
              targetElement: targetChild,
              locales,
              enableI18n,
            })}
          </React.Fragment>
        );
      });
    }

    // Single child
    if (target && typeof target === 'object' && !Array.isArray(target)) {
      const targetType: 'variable' | 'element' = isVariable(target)
        ? 'variable'
        : 'element';

      if (React.isValidElement(source)) {
        if (targetType === 'element') {
          return renderTranslatedElement({
            sourceElement: source,
            targetElement: target as TranslatedElement,
            locales,
            enableI18n,
          });
        }

        // Render variable
        if (isVariableElementProps(source.props)) {
          const {
            variableValue,
            variableOptions,
            variableType,
            injectionType,
          } = getVariableProps(source.props);
          return renderVariable({
            variableType,
            variableValue,
            variableOptions,
            locales,
            enableI18n,
            injectionType,
          });
        }
      }
    }

    // fallback
    return renderDefaultChildren({
      children: source,
      defaultLocale: locales[0],
      enableI18n,
    });
  }

  return renderTranslatedChildren;
}

export { createRenderTranslatedChildren };
export type { RenderTranslatedChildrenArgs };
