import { isVNode } from 'vue';
import type { VNode, VNodeChild } from 'vue';
import { isAcceptedPluralForm } from 'generaltranslation/internal';
import type {
  TransformationPrefix,
  VariableTransformationSuffix,
} from 'generaltranslation/types';
import type {
  GTTag,
  TaggedChild,
  TaggedChildren,
  TaggedElement,
} from '../types';
import {
  getGtTransformation,
  getVNodeChildren,
  getVNodeNamedSlotChildren,
  isCommentVNode,
  isFragmentVNode,
  isTextVNode,
} from './vnode-utils';

/**
 * Vue port of gt-react's addGTIdentifier: walks the slot content of a `<T>`
 * component and produces a tagged tree with sequential GT ids assigned
 * depth-first. Parallel branches of `<Plural>`/`<Branch>` share the same id
 * space, matching the GT JSX convention.
 *
 * VNodes are never cloned or mutated; the tagged tree wraps them.
 */
export function tagChildren(
  children: VNodeChild,
  startingIndex: number = 0
): TaggedChildren {
  let index = startingIndex;

  const createGTTag = (vnode: VNode): GTTag => {
    index += 1;
    const result: GTTag = { id: index };
    const transformation = getGtTransformation(vnode);
    if (transformation) {
      const transformationParts = transformation.split('-');
      if (transformationParts[0] === 'translate') {
        // Convert nested <T> to fragments
        transformationParts[0] = 'fragment';
      }
      if (transformationParts[0] === 'variable') {
        result.variableType =
          (transformationParts?.[1] as VariableTransformationSuffix) ||
          'variable';
      }
      if (transformationParts[0] === 'plural') {
        const namedSlots = getVNodeNamedSlotChildren(vnode);
        const pluralBranches = Object.entries(namedSlots).reduce(
          (acc, [branchName, branch]) => {
            if (isAcceptedPluralForm(branchName)) {
              acc[branchName] = tagChildren(branch, index);
            }
            return acc;
          },
          {} as Record<string, TaggedChildren>
        );
        if (Object.keys(pluralBranches).length) {
          result.branches = pluralBranches;
        }
      }
      if (transformationParts[0] === 'branch') {
        const namedSlots = getVNodeNamedSlotChildren(vnode);
        const resultBranches = Object.entries(namedSlots).reduce(
          (acc, [branchName, branch]) => {
            acc[branchName] = tagChildren(branch, index);
            return acc;
          },
          {} as Record<string, TaggedChildren>
        );
        if (Object.keys(resultBranches).length) {
          result.branches = resultBranches;
        }
      }
      result.transformation = transformationParts[0] as TransformationPrefix;
    }
    if (isFragmentVNode(vnode)) {
      result.transformation = 'fragment';
    }
    return result;
  };

  function handleSingleVNode(vnode: VNode): TaggedElement {
    const gt = createGTTag(vnode);
    const result: TaggedElement = { vnode, gt };
    if (!gt.variableType) {
      const children = getVNodeChildren(vnode);
      if (children != null) {
        result.children = handleChildren(children);
      }
    }
    return result;
  }

  function handleSingleChild(child: VNodeChild): TaggedChild | TaggedChild[] {
    if (isVNode(child)) {
      if (isTextVNode(child)) return child.children as string;
      if (isCommentVNode(child)) return null;
      return handleSingleVNode(child);
    }
    if (typeof child === 'boolean') return null;
    return child as TaggedChild;
  }

  function handleChildren(children: VNodeChild): TaggedChildren {
    if (Array.isArray(children)) {
      // Flatten nested arrays and drop null/comment children, mirroring
      // React.Children.map semantics.
      const result: TaggedChild[] = [];
      for (const child of children) {
        const handled = Array.isArray(child)
          ? (handleChildren(child) as TaggedChild[])
          : handleSingleChild(child);
        if (Array.isArray(handled)) {
          result.push(...handled.filter((c) => c != null));
        } else if (handled != null) {
          result.push(handled);
        }
      }
      return result;
    }
    return handleSingleChild(children) as TaggedChildren;
  }

  return handleChildren(children);
}
