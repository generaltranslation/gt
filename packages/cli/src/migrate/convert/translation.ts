import {
  validateMessageTree,
  type MessageBranches,
  type MessageFormats,
  type MessageNode,
  type MessageTree,
  type PluralNode,
  type SelectNode,
} from '@generaltranslation/icu';
import { checkTranslation } from '@generaltranslation/icu/convert';
import { forEachPlaceholder } from '@generaltranslation/icu/internal';
import type {
  BranchFillCounts,
  LegacyDataFormat,
  RenameMap,
} from '../types.js';
import { convertLegacyValue, errorText, invalidTreeReason } from './legacy.js';
import {
  canonicalizeTree,
  mapBranches,
  mapTree,
  renameVariables,
} from './tree.js';
import { stringifySortedJson } from '../../fs/sortedJson.js';
import { ownValue } from '../catalogs.js';

type PluralRulesByType = (
  type: Intl.PluralRuleType
) => { categories: string[]; select: (n: number) => string } | undefined;

function branchKey(node: SelectNode | PluralNode): string {
  return node[1] === 'select'
    ? JSON.stringify([node[0], 'select'])
    : JSON.stringify([node[0], node[1], node[3] ?? 0]);
}

function sourceBranchKeys(tree: MessageTree): Map<string, Set<string>> {
  const keys = new Map<string, Set<string>>();
  forEachPlaceholder(tree, (node) => {
    if (
      node[1] !== 'select' &&
      node[1] !== 'plural' &&
      node[1] !== 'selectordinal'
    ) {
      return;
    }
    const key = branchKey(node);
    const known = keys.get(key) ?? new Set<string>();
    for (const branch of Object.keys(node[2])) known.add(branch);
    keys.set(key, known);
  });
  return keys;
}

function pluralRules(locale: string): PluralRulesByType {
  let supported = false;
  try {
    supported = Intl.PluralRules.supportedLocalesOf(locale).length > 0;
  } catch {
    supported = false;
  }
  return (type) => {
    if (!supported) return undefined;
    const rules = new Intl.PluralRules(locale, { type });
    return {
      categories: rules.resolvedOptions().pluralCategories,
      select: (n) => rules.select(n),
    };
  };
}

function has(branches: MessageBranches, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(branches, key);
}

/** Each added branch copies the one the legacy ICU runtime showed: `other`, or for a missing `=N` the branch of N's category. */
export function fillTranslationBranches(
  sourceTree: MessageTree,
  translationTree: MessageTree,
  locale: string
): { tree: MessageTree; counts: BranchFillCounts } {
  const counts: BranchFillCounts = { categories: 0, keys: 0, dropped: 0 };
  const sourceKeys = sourceBranchKeys(sourceTree);
  const rulesFor = pluralRules(locale);
  const fill = (tree: MessageTree): MessageTree =>
    mapTree(tree, (node): MessageNode => {
      if (node[1] === 'tag') return [node[0], 'tag', fill(node[2])];
      if (
        node[1] !== 'select' &&
        node[1] !== 'plural' &&
        node[1] !== 'selectordinal'
      ) {
        return node;
      }
      const branches = mapBranches(node[2], fill);
      const source = sourceKeys.get(branchKey(node));
      if (!has(branches, 'other')) return [node[0], node[1], branches];
      if (node[1] === 'select') {
        const filled = Object.entries(branches).filter(([key]) => {
          if (!source || source.has(key)) return true;
          counts.dropped++;
          return false;
        });
        for (const key of source ?? []) {
          if (has(branches, key)) continue;
          filled.push([key, branches.other]);
          counts.keys++;
        }
        return [node[0], 'select', Object.fromEntries(filled)];
      }
      const offset = node[3] ?? 0;
      const rules = rulesFor(node[1] === 'plural' ? 'cardinal' : 'ordinal');
      for (const category of rules?.categories ?? []) {
        if (has(branches, category)) continue;
        branches[category] = branches.other;
        counts.categories++;
      }
      for (const key of source ?? []) {
        if (key[0] !== '=' || has(branches, key)) continue;
        const category = rules?.select(Number(key.slice(1)) - offset);
        branches[key] =
          category !== undefined && has(branches, category)
            ? branches[category]
            : branches.other;
        counts.keys++;
      }
      return node[3]
        ? [node[0], node[1], branches, node[3]]
        : [node[0], node[1], branches];
    });
  return { tree: canonicalizeTree(fill(translationTree)), counts };
}

/** Checks a translation exactly as the server checks a MESSAGE_TREE upload. */
export function validateMigratedTranslation(
  sourceTree: MessageTree,
  value: unknown,
  locale: string
): string | undefined {
  const error = validateMessageTree(value);
  if (error) return invalidTreeReason(error);
  try {
    return checkTranslation(
      sourceTree,
      { tree: value as MessageTree, formats: {} },
      { locale }
    );
  } catch (thrown) {
    return errorText(thrown);
  }
}

function formatsMismatch(
  tree: MessageTree,
  formats: MessageFormats,
  sourceFormats: MessageFormats
): string[] {
  const names = new Set<string>(Object.keys(formats));
  forEachPlaceholder(tree, (node) => {
    if (node[1] === 'number' || node[1] === 'date' || node[1] === 'time') {
      names.add(node[0]);
    }
  });
  return [...names].filter(
    (name) =>
      stringifySortedJson(ownValue(formats, name), 0) !==
      stringifySortedJson(ownValue(sourceFormats, name), 0)
  );
}

export type MigrateTranslationInput = {
  /** The new source's tree, in the new variable names. */
  sourceTree: MessageTree;
  /** The old source's formats, in the old variable names. */
  sourceFormats: MessageFormats;
  oldValue: unknown;
  oldDataFormat: LegacyDataFormat;
  /** Old variable names to new ones. */
  renameMap: RenameMap;
  locale: string;
  fill: boolean;
};

export type MigrateTranslationResult =
  | { ok: true; tree: MessageTree; filled?: BranchFillCounts }
  | { ok: false; reason: string };

export function migrateTranslation({
  sourceTree,
  sourceFormats,
  oldValue,
  oldDataFormat,
  renameMap,
  locale,
  fill,
}: MigrateTranslationInput): MigrateTranslationResult {
  const converted = convertLegacyValue(oldValue, oldDataFormat, locale);
  if (!converted.ok) return converted;
  const mismatched = formatsMismatch(
    converted.tree,
    converted.formats,
    sourceFormats
  );
  if (mismatched.length) {
    return {
      ok: false,
      reason: `The translation formats ${mismatched.map((name) => `"${name}"`).join(', ')} differently from its source`,
    };
  }
  let tree = renameVariables(converted.tree, renameMap);
  let filled: BranchFillCounts | undefined;
  if (fill) {
    const result = fillTranslationBranches(sourceTree, tree, locale);
    tree = result.tree;
    const { categories, keys, dropped } = result.counts;
    if (categories + keys + dropped > 0) filled = result.counts;
  }
  tree = canonicalizeTree(tree);
  const reason = validateMigratedTranslation(sourceTree, tree, locale);
  if (reason) return { ok: false, reason };
  return filled ? { ok: true, tree, filled } : { ok: true, tree };
}
