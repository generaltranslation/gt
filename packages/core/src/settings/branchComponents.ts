import type { GTProp } from '@generaltranslation/format';

/**
 * The components whose props are branches, each with the transformation its
 * branches are stored under. An `<Ordinal>` is read as a `<Plural>` is; only
 * this differs.
 */
export const branchComponentTransformations = {
  Branch: 'b',
  Plural: 'p',
  Ordinal: 'o',
} as const satisfies Record<string, NonNullable<GTProp['t']>>;

export type BranchComponentName = keyof typeof branchComponentTransformations;

export function isBranchComponentName(
  name: string | null | undefined
): name is BranchComponentName {
  return (
    name != null &&
    // Not Object.hasOwn: the compiler supports Node 16.0, which lacks it.
    Object.prototype.hasOwnProperty.call(branchComponentTransformations, name)
  );
}

/** Whether a component is a `<Plural>` or an `<Ordinal>`. */
export function isPluralComponentName(
  name: string | null | undefined
): name is Exclude<BranchComponentName, 'Branch'> {
  return isBranchComponentName(name) && name !== 'Branch';
}
