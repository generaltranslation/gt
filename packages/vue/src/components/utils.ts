import {
  type Component,
  type DefineComponent,
  type Slots,
  type VNodeChild,
} from 'vue';

const NON_BRANCH_ATTRIBUTE_NAMES = new Set([
  'class',
  'key',
  'n',
  // The fallback is the default slot, so `other` names no branch.
  'other',
  'ref',
  'ref-for',
  'ref-key',
  'ref_for',
  'ref_key',
  'style',
  'value',
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

/**
 * The locales a variable formats in and a plural is selected in: the active
 * locale.
 *
 * @internal
 */
export function getFormatLocales(
  locale: string,
  resolveLocale: (locale: string) => string = identityLocale
): string[] {
  return [resolveLocale(locale)];
}

function identityLocale(locale: string): string {
  return locale;
}

/**
 * Normalizes a render result to a Fragment component root.
 *
 * Vue's server renderer concatenates adjacent scalar component roots into one
 * text node. Returning an array makes Vue emit Fragment anchors, so hydration
 * can recover each GT-owned boundary even when several components render next
 * to plain text or change between source and translated content.
 *
 * @internal
 */
export function asFragmentRoot(children: VNodeChild): VNodeChild[] {
  if (Array.isArray(children)) return children;
  if (children == null || typeof children === 'boolean') return [];
  return [children];
}

/**
 * Returns whether an inherited component attribute is translation content for
 * `Select` or `Plural`.
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

/** Names of the attributes and slots that can be branches. @internal */
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
        (key) => key !== 'default' && key !== 'other'
      ),
    ]),
  ];
}

/** The content of a branch, which is empty for a branch there is not. @internal */
export function getBranchContent(
  branch: string,
  attrs: Record<string, unknown>,
  slots: Slots
) {
  if (
    Object.prototype.hasOwnProperty.call(slots, branch) &&
    typeof slots[branch] === 'function'
  ) {
    return slots[branch]();
  }
  const value = attrs[branch];
  if (isBranchAttribute(branch, value)) {
    return value === null || typeof value === 'boolean' ? null : String(value);
  }
  return null;
}
