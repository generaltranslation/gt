import type { VNodeChild } from 'vue';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import { getPluralBranch } from 'gt-i18n/internal';
import type { TaggedChild, TaggedChildren, TaggedElement } from '../types';
import { getVariableProps, isVariableTaggedElement } from './getVariableProps';
import { recreateVNode } from './recreateVNode';
import { renderVariable } from './renderVariable';

export type RenderDefaultChildrenArgs = {
  children: TaggedChildren;
  defaultLocale: string;
  enableI18n: boolean;
};

/**
 * Renders a tagged tree in the source language: variables are formatted with
 * the default locale, and plural/branch components are resolved to the
 * appropriate branch.
 */
export function renderDefaultChildren({
  children,
  defaultLocale = libraryDefaultLocale,
  enableI18n,
}: RenderDefaultChildrenArgs): VNodeChild {
  const handleSingleChildElement = (child: TaggedElement): VNodeChild => {
    const { gt, vnode } = child;
    const props = (vnode.props ?? {}) as Record<string, unknown>;

    // Variable
    if (isVariableTaggedElement(child)) {
      const { variableType, variableValue, variableOptions } =
        getVariableProps(child);
      return renderVariable({
        variableType,
        variableValue,
        variableOptions,
        locales: [defaultLocale],
        enableI18n,
      });
    }

    // Plural
    if (gt.transformation === 'plural') {
      const branches = gt.branches || {};
      if (typeof props.n !== 'number') {
        return child.children != null ? handleChildren(child.children) : null;
      }
      const resolvedBranch = getPluralBranch(
        props.n,
        [defaultLocale],
        branches
      );
      return handleChildren(
        resolvedBranch !== null ? resolvedBranch : child.children
      );
    }

    // Branch
    if (gt.transformation === 'branch') {
      const branches = gt.branches || {};
      const branchKey =
        props.branch == null || props.branch === ''
          ? undefined
          : String(props.branch);
      return handleChildren(
        branchKey && branches[branchKey] !== undefined
          ? branches[branchKey]
          : child.children
      );
    }

    // Fragment
    if (gt.transformation === 'fragment') {
      return child.children != null ? handleChildren(child.children) : null;
    }

    // Default
    if (child.children != null) {
      return recreateVNode(vnode, null, handleChildren(child.children));
    }
    return vnode;
  };

  const handleSingleChild = (child: TaggedChild): VNodeChild => {
    if (child && typeof child === 'object') {
      return handleSingleChildElement(child);
    }
    return child as VNodeChild;
  };

  const handleChildren = (children: TaggedChildren): VNodeChild => {
    return Array.isArray(children)
      ? children.map(handleSingleChild)
      : handleSingleChild(children);
  };

  return handleChildren(children);
}
