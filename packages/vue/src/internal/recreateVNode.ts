import { h, isVNode } from 'vue';
import type { VNode, VNodeChild } from 'vue';

/**
 * Recreates a VNode with replacement children (and optional extra props).
 * The original VNode is never mutated. For component VNodes, named slots are
 * preserved and only the default slot is replaced.
 */
export function recreateVNode(
  vnode: VNode,
  extraProps: Record<string, unknown> | null,
  newChildren: VNodeChild
): VNode {
  const props: Record<string, unknown> = {
    ...vnode.props,
    ...extraProps,
  };
  if (vnode.key != null) props.key = vnode.key;

  if (typeof vnode.type === 'string') {
    return h(vnode.type, props, newChildren ?? undefined);
  }

  // Component: replace the default slot, keep other slots
  const slots: Record<string, unknown> = {};
  const children = vnode.children;
  if (
    children &&
    typeof children === 'object' &&
    !Array.isArray(children) &&
    !isVNode(children)
  ) {
    for (const [name, slot] of Object.entries(children)) {
      if (name === '_' || name === '$stable') continue;
      slots[name] = slot;
    }
  }
  if (newChildren != null) {
    slots.default = () => newChildren;
  }
  return h(vnode.type as Parameters<typeof h>[0], props, slots);
}
