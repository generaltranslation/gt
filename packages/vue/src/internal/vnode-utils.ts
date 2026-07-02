import { Comment, Fragment, Static, Text, isVNode } from 'vue';
import type { VNode, VNodeChild } from 'vue';
import type { Transformation } from 'generaltranslation/types';

/**
 * Reads the GT transformation marker from a VNode's component type.
 * GT components carry a static `_gtt` property, mirroring gt-react.
 */
export function getGtTransformation(vnode: VNode): Transformation | undefined {
  const type = vnode.type;
  if (
    (typeof type === 'function' || typeof type === 'object') &&
    type !== null &&
    '_gtt' in type
  ) {
    return (type as { _gtt?: Transformation })._gtt;
  }
  return undefined;
}

export function isElementVNode(vnode: VNode): boolean {
  return typeof vnode.type === 'string';
}

export function isComponentVNode(vnode: VNode): boolean {
  return typeof vnode.type === 'function' || typeof vnode.type === 'object';
}

export function isFragmentVNode(vnode: VNode): boolean {
  return vnode.type === Fragment;
}

export function isTextVNode(vnode: VNode): boolean {
  return vnode.type === Text;
}

export function isCommentVNode(vnode: VNode): boolean {
  return vnode.type === Comment || vnode.type === Static;
}

type SlotFn = (...args: unknown[]) => VNodeChild;

function getSlots(vnode: VNode): Record<string, SlotFn> | null {
  const children = vnode.children;
  if (
    children &&
    typeof children === 'object' &&
    !Array.isArray(children) &&
    !isVNode(children)
  ) {
    return children as unknown as Record<string, SlotFn>;
  }
  return null;
}

/**
 * Returns the rendered default slot content of a component VNode, or its raw
 * children for element/fragment VNodes.
 */
export function getVNodeChildren(vnode: VNode): VNodeChild {
  if (isComponentVNode(vnode)) {
    const slots = getSlots(vnode);
    const defaultSlot = slots?.default;
    if (typeof defaultSlot === 'function') return defaultSlot();
    return null;
  }
  return vnode.children as VNodeChild;
}

/**
 * Returns the rendered content of a component VNode's named slots
 * (excluding `default`).
 */
export function getVNodeNamedSlotChildren(
  vnode: VNode
): Record<string, VNodeChild> {
  const result: Record<string, VNodeChild> = {};
  const slots = getSlots(vnode);
  if (!slots) return result;
  for (const [name, slot] of Object.entries(slots)) {
    if (name === 'default' || name.startsWith('_')) continue;
    if (typeof slot === 'function') result[name] = slot();
  }
  return result;
}

/**
 * Extracts the text content from a VNode child tree.
 * Used by variable components to parse slot content (e.g. `<Num>{{ n }}</Num>`).
 */
export function getVNodeChildText(children: VNodeChild): string | undefined {
  if (children == null || typeof children === 'boolean') return undefined;
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return children.toString();
  if (Array.isArray(children)) {
    const parts = children
      .map((child) => getVNodeChildText(child as VNodeChild))
      .filter((part): part is string => part !== undefined);
    return parts.length ? parts.join('') : undefined;
  }
  if (isVNode(children)) {
    if (isTextVNode(children)) return children.children as string;
    return getVNodeChildText(getVNodeChildren(children));
  }
  return undefined;
}
