import {
  isVNode,
  type Component,
  type DefineComponent,
  type Slots,
  type VNodeChild,
} from 'vue';

const NON_BRANCH_ATTRIBUTE_NAMES = new Set([
  'branch',
  'class',
  'key',
  'locales',
  'n',
  'ref',
  'ref-for',
  'ref-key',
  'ref_for',
  'ref_key',
  'style',
]);

/** Values that Vue and the extractor can represent as an attribute branch. */
export type BranchAttributeValue = bigint | boolean | null | number | string;

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

/**
 * Returns whether an inherited component attribute is translation content for
 * `Branch` or `Plural`.
 *
 * Vue places presentation attributes, listeners, and arbitrary objects in the
 * same `$attrs` object as explicit branch attributes. Treating all of them as
 * content leaks class/style data and function source into translation hashes.
 * This predicate is therefore shared by standalone branch selection and rich
 * source serialization. Named slots are handled separately and take
 * precedence over attributes with the same name.
 *
 * Static primitive attributes mirror what the extractor can publish. Strings,
 * numbers, and bigints render as text; booleans and null are present branches
 * with empty content. Undefined, objects, and functions are not branches.
 */
export function isBranchAttribute(
  name: string,
  value: unknown
): value is BranchAttributeValue {
  if (
    NON_BRANCH_ATTRIBUTE_NAMES.has(name) ||
    name.startsWith('aria-') ||
    name.startsWith('data-') ||
    /^on[^a-z]/.test(name)
  ) {
    return false;
  }
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'bigint' ||
    typeof value === 'boolean'
  );
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
      ...Object.entries(attrs)
        .filter(([name, value]) => isBranchAttribute(name, value))
        .map(([name]) => name),
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
    Object.prototype.hasOwnProperty.call(slots, branch) &&
    typeof slots[branch] === 'function'
  ) {
    return slots[branch]();
  }
  const value = branch ? attrs[branch] : undefined;
  if (branch && isBranchAttribute(branch, value)) {
    return value === null || typeof value === 'boolean' ? null : String(value);
  }
  return slots.default?.() ?? null;
}
