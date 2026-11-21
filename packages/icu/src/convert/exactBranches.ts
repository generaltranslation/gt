import type {
  MessageBranches,
  MessageNode,
  MessageTree,
} from '../tree/messageTree';
import { compareKeys } from '../tree/canonical';
import {
  isBranchingNode,
  isPlaceholderNode,
  isTagNode,
  mapBranches,
  messageTreeNodes,
} from '../tree/walk';
import { getPluralCategoryCounts } from './pluralCategories';

/** The number a locale picks a cardinal category for, where it picks it for that number alone. */
function onlyCount(locale: string, category: string): number | undefined {
  const picked = getPluralCategoryCounts(locale, 'cardinal', category);
  return picked?.counts.length === 1 && !picked.more
    ? picked.counts[0]
    : undefined;
}

/**
 * The number a cardinal plural branch stands for, where its category does
 * not stand for that number alone in the translation. A category is not a
 * number: English `one` is only 1, so its branch may say "one file" in
 * words. Russian `one` is also 21 and Japanese has no `one`, so translated
 * into either, that text is right as the exact branch `=1` and nowhere else:
 *
 *   getExactBranchCount('one', 'en', 'ru'); // 1
 *   getExactBranchCount('one', 'en', 'de'); // undefined: German `one` is only 1 too
 *   getExactBranchCount('one', 'ru', 'en'); // undefined: Russian `one` says no one number
 *
 * Nothing when Intl has no plural rules for either locale.
 */
export function getExactBranchCount(
  category: string,
  sourceLocale: string,
  targetLocale: string
): number | undefined {
  if (!getPluralCategoryCounts(targetLocale, 'cardinal', category)) {
    return undefined;
  }
  const count = onlyCount(sourceLocale, category);
  return count === onlyCount(targetLocale, category) ? undefined : count;
}

/** Whether a branch of the plural `name` shows its count: its own `#`, or the variable printed where there is no offset. */
function showsCount(
  tree: MessageTree,
  name: string,
  offset: number,
  own = true
): boolean {
  return messageTreeNodes(tree).some((node) => {
    if (!isPlaceholderNode(node)) return node === 0 && own;
    if (isTagNode(node)) return showsCount(node[2], name, offset, own);
    if (isBranchingNode(node)) {
      // A `#` in a plural's branch is that plural's count, and one in a select's branch is text.
      return Object.values(node[2]).some((branch) =>
        showsCount(branch, name, offset, false)
      );
    }
    return (
      !offset &&
      node[0] === name &&
      (node[1] === undefined || node[1] === 'number')
    );
  });
}

/**
 * A source message as it is translated from `sourceLocale` into
 * `targetLocale`: each cardinal plural branch that says its one number in
 * words is the exact branch of that number, by `getExactBranchCount`.
 *
 *   {n, plural, one {One file} other {# files}}    en -> ru
 *   {n, plural, =1 {One file} other {# files}}
 *
 * The translation then keeps `=1`, which `checkTranslation` asks of it, and
 * writes the locale's own categories from `other`. A branch that shows the
 * count stays, since it reads right at every number its category takes, and
 * so does one whose number has an exact branch already.
 */
export function moveToExactBranches(
  tree: MessageTree,
  sourceLocale: string,
  targetLocale: string
): MessageTree {
  if (typeof tree === 'string') return tree;
  const move = (branch: MessageTree) =>
    moveToExactBranches(branch, sourceLocale, targetLocale);
  return tree.map((node): MessageNode => {
    if (!isPlaceholderNode(node)) return node;
    if (isTagNode(node)) return [node[0], 'tag', move(node[2])];
    if (!isBranchingNode(node)) return node;
    if (node[1] === 'select') {
      return [node[0], 'select', mapBranches(node[2], move)];
    }
    const [name, kind, branches, offset] = node;
    const moved =
      kind === 'plural'
        ? moveBranches(branches, (key) => {
            const count = getExactBranchCount(key, sourceLocale, targetLocale);
            // An exact branch is picked by the number, and a category by the number less the offset.
            const exact =
              count === undefined ? undefined : `=${count + (offset ?? 0)}`;
            return exact !== undefined &&
              !Object.hasOwn(branches, exact) &&
              !showsCount(branches[key], name, offset ?? 0)
              ? exact
              : key;
          })
        : branches;
    const translated = mapBranches(moved, move);
    return offset === undefined
      ? [name, kind, translated]
      : [name, kind, translated, offset];
  });
}

/** Branches under new keys, sorted as a tree keeps them. */
function moveBranches(
  branches: MessageBranches,
  keyOf: (key: string) => string
): MessageBranches {
  // Object.fromEntries defines own properties, so a `__proto__` branch stays one.
  return Object.fromEntries(
    Object.entries(branches)
      .map(([key, branch]): [string, MessageTree] => [keyOf(key), branch])
      .sort(([a], [b]) => compareKeys(a, b))
  );
}
