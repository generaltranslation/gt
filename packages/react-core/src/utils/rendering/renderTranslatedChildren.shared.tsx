import React, { ReactNode } from 'react';
import {
  TaggedChildren,
  TaggedElement,
  TranslatedChildren,
  TranslatedElement,
  VariableProps,
} from '../types';
import {
  COUNT_VARIABLE_TYPE,
  getVariableProps,
  isVariableElementProps,
} from '../variables/_getVariableProps';
import { createRenderDefaultChildren } from './renderDefaultChildren.shared';
import { isVariable } from 'generaltranslation/internal';
import { defaultDefaultLocale } from '@generaltranslation/format/internal';
import {
  getBranch,
  getPluralBranch,
  isCount,
  selectBranchKey,
  selectPluralKey,
} from '../plurals/getPluralBranch';
import {
  HTML_CONTENT_PROPS,
  HtmlContentPropValuesRecord,
} from '@generaltranslation/format';
import { getGTTag } from './getGTTag';
import type { RenderVariable } from '../types';

const isCountVariable = (child: unknown): boolean =>
  isVariable(child) && child.v === COUNT_VARIABLE_TYPE;

// Shared implementation: the variable renderer is dependency-injected by a
// factory so this module statically imports no variable components.
// Callsites use the pre-instantiated renderPipeline.rsc module instead of
// importing this directly.

type RenderTranslatedChildrenArgs = {
  source: TaggedChildren;
  target: TranslatedChildren;
  locales: string[];
  enableI18n: boolean;
  /** The `n` of the nearest `<Plural>`, which a count variable shows. */
  count?: number | bigint;
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
    count,
  }: {
    sourceElement: TaggedElement;
    targetElement: TranslatedElement;
    locales: string[];
    enableI18n: boolean;
    count?: number | bigint;
  }): React.ReactNode {
    // Get props and generaltranslation
    const { props: sourceProps } = sourceElement;
    const sourceGT = sourceProps['data-_gt'];

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
    if (
      sourceGT?.transformation === 'plural' ||
      sourceGT?.transformation === 'ordinal'
    ) {
      const n = sourceElement.props.n;
      const ordinal = sourceGT.transformation === 'ordinal';
      const targetBranches = targetElement.d?.b || {};
      const key = selectPluralKey(n, locales, targetBranches, ordinal);
      const target = targetBranches[key] as TranslatedChildren;
      return renderTranslatedChildren({
        source: getPluralBranch(
          n,
          locales,
          sourceGT.branches || {},
          ordinal,
          target === undefined ? undefined : key
        ),
        target,
        locales,
        enableI18n,
        // An `n` that is no number is reported where the branch is picked.
        count: isCount(n) ? n : undefined,
      });
    }

    if (sourceGT?.transformation === 'select') {
      const { value } = sourceProps;
      const targetBranches = targetElement.d?.b || {};
      const key = selectBranchKey(value, targetBranches);
      const target = targetBranches[key] as TranslatedChildren;
      return renderTranslatedChildren({
        source: getBranch(
          value,
          sourceGT.branches || {},
          target === undefined ? undefined : key
        ),
        target,
        locales,
        enableI18n,
        count,
      });
    }

    // fragment (create a valid fragment)
    if (sourceGT?.transformation === 'fragment' && targetElement.c) {
      return React.createElement(React.Fragment, {
        key: sourceElement.props.key,
        children: renderTranslatedChildren({
          source: sourceProps.children as TaggedChildren,
          target: targetElement.c,
          locales,
          enableI18n,
          count,
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
          count,
        }) as TaggedChildren,
      });
    }

    // fallback
    return renderDefaultChildren({
      children: sourceElement,
      defaultLocale: locales[0],
      locales,
      enableI18n,
    });
  }

  function renderTranslatedChildren({
    source,
    target,
    locales = [defaultDefaultLocale],
    enableI18n,
    count,
  }: RenderTranslatedChildrenArgs): ReactNode {
    // As `#` is in ICU: the source branch a translated branch pairs with may
    // have no count of its own, so it comes from the plural. With no plural
    // in this `<T>`, a count is the source variable of its id, like any other.
    const renderCount = (value: number | bigint) =>
      renderVariable({
        variableType: 'n',
        variableValue: value,
        variableOptions: {},
        locales,
        enableI18n,
        injectionType: 'manual',
      });

    // Most straightforward case, return a valid React node
    if ((target === null || typeof target === 'undefined') && source)
      return renderDefaultChildren({
        children: source,
        defaultLocale: locales[0],
        locales,
        enableI18n,
      });
    if (typeof target === 'string') return target;
    if (isCountVariable(target) && count !== undefined) {
      return renderCount(count);
    }

    // Convert source to an array in case target has multiple children where source only has one
    if (Array.isArray(target) && !Array.isArray(source) && source)
      source = [source];

    // Multiple children
    if (Array.isArray(source) && Array.isArray(target)) {
      // Track the variables
      const variables: Record<number, VariableProps['variableValue']> = {};
      const variablesOptions: Record<number, VariableProps['variableOptions']> =
        {};
      const variableInjectionTypes: Record<
        number,
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
                variableId,
                variableValue,
                variableOptions,
                injectionType,
              } = getVariableProps(sourceChild.props);
              variables[variableId] = variableValue;
              variablesOptions[variableId] = variableOptions;
              variableInjectionTypes[variableId] = injectionType;
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

        if (isCountVariable(targetChild) && count !== undefined) {
          return (
            <React.Fragment key={`var_${index}`}>
              {renderCount(count)}
            </React.Fragment>
          );
        }

        // Render variable
        if (isVariable(targetChild)) {
          return (
            <React.Fragment key={`var_${index}`}>
              {renderVariable({
                variableType: targetChild.v,
                variableValue: variables[targetChild.i],
                variableOptions: variablesOptions[targetChild.i],
                locales,
                enableI18n,
                injectionType:
                  variableInjectionTypes[targetChild.i] || 'manual',
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
              count,
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
            count,
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
      locales,
      enableI18n,
    });
  }

  return renderTranslatedChildren;
}

export { createRenderTranslatedChildren };
export type { RenderTranslatedChildrenArgs };
