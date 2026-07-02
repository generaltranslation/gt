import type { VNodeChild } from 'vue';
import { isVariable, libraryDefaultLocale } from 'generaltranslation/internal';
import {
  HTML_CONTENT_PROPS,
  type HtmlContentPropValuesRecord,
  type JsxChildren,
  type JsxElement,
} from '@generaltranslation/format/types';
import { getPluralBranch } from 'gt-i18n/internal';
import type { TaggedChildren, TaggedElement, VariableProps } from '../types';
import { getVariableProps, isVariableTaggedElement } from './getVariableProps';
import { recreateVNode } from './recreateVNode';
import { renderDefaultChildren } from './renderDefaultChildren';
import { renderVariable } from './renderVariable';

export type RenderTranslatedChildrenArgs = {
  source: TaggedChildren;
  target: JsxChildren;
  locales: string[];
  enableI18n: boolean;
};

/**
 * Reconciles a translated GT JSX tree against the tagged source tree:
 * walks the target, re-attaching source VNodes (matched by GT id) with
 * translated text, reordered structure, and re-rendered variables.
 */
export function renderTranslatedChildren({
  source,
  target,
  locales = [libraryDefaultLocale],
  enableI18n,
}: RenderTranslatedChildrenArgs): VNodeChild {
  // Fall back to the source render when there is no translation
  if (target === null || typeof target === 'undefined') {
    return renderDefaultChildren({
      children: source,
      defaultLocale: locales[0],
      enableI18n,
    });
  }
  if (typeof target === 'string') return target;

  // Convert source to an array in case target has multiple children where
  // source only has one
  if (Array.isArray(target) && !Array.isArray(source) && source) {
    source = [source];
  }

  // Vue slots always produce arrays, while single-root translations are
  // stored as a single node — wrap the target so they reconcile
  if (Array.isArray(source) && !Array.isArray(target)) {
    target = [target];
  }

  // Multiple children
  if (Array.isArray(source) && Array.isArray(target)) {
    // Track the variables declared at this level of the source tree
    const variables: Record<string, VariableProps['variableValue']> = {};
    const variablesOptions: Record<string, VariableProps['variableOptions']> =
      {};

    const sourceElements: TaggedElement[] = source.filter(
      (sourceChild): sourceChild is TaggedElement => {
        if (sourceChild && typeof sourceChild === 'object') {
          if (isVariableTaggedElement(sourceChild)) {
            const { variableName, variableValue, variableOptions } =
              getVariableProps(sourceChild);
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
      targetElement: JsxElement
    ): TaggedElement | undefined => {
      return (
        sourceElements.find(
          (sourceChild) => sourceChild.gt.id === targetElement.i
        ) || sourceElements.shift()
      );
    };

    return target.map((targetChild) => {
      if (typeof targetChild === 'string') return targetChild;

      if (isVariable(targetChild)) {
        return renderVariable({
          variableType: targetChild.v || 'v',
          variableValue: variables[targetChild.k],
          variableOptions: variablesOptions[targetChild.k],
          locales,
          enableI18n,
        });
      }

      const matchingSourceElement = findMatchingSourceElement(
        targetChild as JsxElement
      );
      if (!matchingSourceElement) return null;
      return renderTranslatedElement({
        sourceElement: matchingSourceElement,
        targetElement: targetChild as JsxElement,
        locales,
        enableI18n,
      });
    });
  }

  // Single child
  if (target && typeof target === 'object' && !Array.isArray(target)) {
    if (source && typeof source === 'object' && !Array.isArray(source)) {
      if (!isVariable(target)) {
        return renderTranslatedElement({
          sourceElement: source,
          targetElement: target as JsxElement,
          locales,
          enableI18n,
        });
      }

      if (isVariableTaggedElement(source)) {
        const { variableValue, variableOptions, variableType } =
          getVariableProps(source);
        return renderVariable({
          variableType,
          variableValue,
          variableOptions,
          locales,
          enableI18n,
        });
      }
    }
  }

  // Fallback
  return renderDefaultChildren({
    children: source,
    defaultLocale: locales[0],
    enableI18n,
  });
}

function renderTranslatedElement({
  sourceElement,
  targetElement,
  locales = [libraryDefaultLocale],
  enableI18n,
}: {
  sourceElement: TaggedElement;
  targetElement: JsxElement;
  locales: string[];
  enableI18n: boolean;
}): VNodeChild {
  const { gt, vnode } = sourceElement;
  const props = (vnode.props ?? {}) as Record<string, unknown>;
  const transformation = gt.transformation;

  // Translated HTML content props (placeholder, title, aria-*)
  const unprocessedTargetGT = targetElement.d;
  const translatedProps: HtmlContentPropValuesRecord = {};
  if (unprocessedTargetGT) {
    Object.entries(HTML_CONTENT_PROPS).forEach(([minifiedName, fullName]) => {
      const value =
        unprocessedTargetGT[minifiedName as keyof typeof HTML_CONTENT_PROPS];
      if (value) {
        translatedProps[fullName] = value as string;
      }
    });
  }

  // Plural (choose a branch)
  if (transformation === 'plural') {
    const n = props.n;
    if (typeof n !== 'number') {
      return renderDefaultChildren({
        children: sourceElement,
        defaultLocale: locales[0],
        enableI18n,
      });
    }
    const sourceBranches = gt.branches || {};
    const resolvedSourceBranch = getPluralBranch(n, locales, sourceBranches);
    const sourceBranch =
      resolvedSourceBranch !== null
        ? resolvedSourceBranch
        : sourceElement.children;
    const targetBranches = targetElement.d?.b || {};
    const resolvedTargetBranch = getPluralBranch(n, locales, targetBranches);
    const targetBranch =
      resolvedTargetBranch !== null ? resolvedTargetBranch : targetElement.c;
    return renderTranslatedChildren({
      source: sourceBranch as TaggedChildren,
      target: targetBranch as JsxChildren,
      locales,
      enableI18n,
    });
  }

  // Branch (choose a branch)
  if (transformation === 'branch') {
    const branch = props.branch;
    const branchKey =
      branch == null || branch === '' ? undefined : String(branch);
    const sourceBranches = gt.branches || {};
    const targetBranches = targetElement.d?.b || {};
    const sourceBranch =
      branchKey && sourceBranches[branchKey] !== undefined
        ? sourceBranches[branchKey]
        : sourceElement.children;
    const targetBranch =
      branchKey && targetBranches[branchKey] !== undefined
        ? targetBranches[branchKey]
        : targetElement.c;
    return renderTranslatedChildren({
      source: sourceBranch as TaggedChildren,
      target: targetBranch as JsxChildren,
      locales,
      enableI18n,
    });
  }

  // Fragment
  if (transformation === 'fragment' && targetElement.c) {
    return renderTranslatedChildren({
      source: sourceElement.children as TaggedChildren,
      target: targetElement.c,
      locales,
      enableI18n,
    });
  }

  // Other elements with translated children
  if (sourceElement.children != null && targetElement.c) {
    return recreateVNode(
      vnode,
      translatedProps,
      renderTranslatedChildren({
        source: sourceElement.children,
        target: targetElement.c,
        locales,
        enableI18n,
      })
    );
  }

  // Childless elements with translated content props (e.g. placeholder)
  if (Object.keys(translatedProps).length) {
    return recreateVNode(vnode, translatedProps, null);
  }

  // Fallback
  return renderDefaultChildren({
    children: sourceElement,
    defaultLocale: locales[0],
    enableI18n,
  });
}
