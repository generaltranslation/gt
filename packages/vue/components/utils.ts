import {
  isVNode,
  type Component,
  type DefineComponent,
  type Slots,
  type VNodeChild,
} from 'vue';

/** @internal GT metadata attached to components for rich-content extraction. */
export type GTComponent<Props = {}> = DefineComponent<Props> & {
  /** @internal */
  _gtt: string;
};

/** @internal */
export function withGTMetadata<Props = {}>(
  component: Component,
  metadata: string
): GTComponent<Props> {
  return Object.assign(component, { _gtt: metadata }) as GTComponent<Props>;
}

/** @internal */
export function getFormatLocales(
  locales: string[] | undefined,
  locale: string
): string[] {
  return [...(locales ?? []), locale];
}

/** @internal */
export function readSlotText(slots: Slots): string {
  return (slots.default?.() ?? []).map(readVNodeText).join('');
}

function readVNodeText(node: VNodeChild): string {
  if (node == null || typeof node === 'boolean') return '';
  if (Array.isArray(node)) return node.map(readVNodeText).join('');
  if (!isVNode(node)) return String(node);
  if (typeof node.children === 'string') return node.children;
  if (Array.isArray(node.children)) {
    return node.children.map(readVNodeText).join('');
  }
  return '';
}

/** @internal */
export function getBranchNames(
  attrs: Record<string, unknown>,
  slots: Slots
): string[] {
  return [
    ...new Set([
      ...Object.keys(attrs).filter((key) => !key.startsWith('data-')),
      ...Object.keys(slots).filter(
        (key) => key !== 'default' && !key.startsWith('_')
      ),
    ]),
  ];
}

/** @internal */
export function getBranchContent(
  branch: string | undefined,
  attrs: Record<string, unknown>,
  slots: Slots
) {
  if (
    branch &&
    Object.hasOwn(slots, branch) &&
    typeof slots[branch] === 'function'
  ) {
    return slots[branch]();
  }
  if (branch && Object.hasOwn(attrs, branch) && attrs[branch] !== undefined) {
    return String(attrs[branch]);
  }
  return slots.default?.() ?? null;
}
