import { minifyVariableType } from 'generaltranslation/internal';
import {
  HTML_CONTENT_PROPS,
  type GTProp,
  type HtmlContentPropKeysRecord,
  type JsxChild,
  type JsxChildren,
  type JsxElement,
  type Variable,
} from '@generaltranslation/format/types';
import type { TaggedChild, TaggedChildren, TaggedElement } from '../types';
import { getVariableName } from './getVariableProps';

/**
 * Gets the wire-format tag name for a tagged VNode.
 */
const getTagName = (child: TaggedElement): string => {
  const { type, props } = child.vnode;
  if (typeof type === 'string') return type;
  if (typeof type === 'function' || (typeof type === 'object' && type)) {
    const name =
      (type as { name?: string; __name?: string; displayName?: string })
        .displayName ??
      (type as { name?: string }).name ??
      (type as { __name?: string }).__name;
    if (typeof name === 'string' && name) return name;
  }
  if (props?.href) return 'a';
  if (child.gt.id) return `C${child.gt.id}`;
  return 'function';
};

const createGTProp = (child: TaggedElement): GTProp | undefined => {
  const props = child.vnode.props ?? {};
  const { transformation, branches } = child.gt;

  // Add translatable HTML content props
  let newGTProp: GTProp = Object.entries(HTML_CONTENT_PROPS).reduce<GTProp>(
    (acc, [minifiedName, fullName]) => {
      const value = props[fullName];
      if (typeof value === 'string') {
        acc[minifiedName as keyof HtmlContentPropKeysRecord] = value;
      }
      return acc;
    },
    {}
  );

  if (transformation === 'plural' && branches) {
    const newBranches: Record<string, JsxChildren> = {};
    Object.entries(branches).forEach(([key, value]) => {
      newBranches[key] = writeChildrenAsObjects(value);
    });
    newGTProp = { ...newGTProp, b: newBranches, t: 'p' };
  }
  if (transformation === 'branch' && branches) {
    const newBranches: Record<string, JsxChildren> = {};
    Object.entries(branches).forEach(([key, value]) => {
      newBranches[key] = writeChildrenAsObjects(value);
    });
    newGTProp = { ...newGTProp, b: newBranches, t: 'b' };
  }

  return Object.keys(newGTProp).length ? newGTProp : undefined;
};

const handleSingleChildElement = (
  child: TaggedElement
): JsxElement | Variable => {
  const { gt, vnode } = child;

  // Variables serialize to { i, k, v } and never serialize their children
  if (gt.transformation === 'variable') {
    const variableType = gt.variableType || 'variable';
    return {
      i: gt.id,
      k: getVariableName(vnode.props ?? {}, variableType, gt.id),
      v: minifyVariableType(variableType),
    };
  }

  const minifiedElement: JsxElement = {
    t: getTagName(child),
    i: gt.id,
  };
  minifiedElement.d = createGTProp(child);
  if (child.children != null) {
    minifiedElement.c = writeChildrenAsObjects(child.children);
  }
  return minifiedElement;
};

const handleSingleChild = (child: TaggedChild): JsxChild => {
  if (child && typeof child === 'object') {
    return handleSingleChildElement(child);
  }
  if (typeof child === 'number') return child.toString();
  return child as JsxChild;
};

/**
 * Converts a tagged tree into GT's minified JSX wire format.
 */
export function writeChildrenAsObjects(children: TaggedChildren): JsxChildren {
  return Array.isArray(children)
    ? children.map(handleSingleChild)
    : handleSingleChild(children);
}
