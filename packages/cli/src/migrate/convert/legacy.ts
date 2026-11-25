import {
  validateMessageTree,
  type MessageFormats,
  type MessageNode,
  type MessageTree,
  type MessageTreeValidationError,
} from '@generaltranslation/icu';
import { icuToMessage } from '@generaltranslation/icu/convert';
import { forEachPlaceholder } from '@generaltranslation/icu/internal';
import {
  parse,
  printAST,
  TYPE,
  type MessageFormatElement,
} from '@generaltranslation/icu/parser';
import { indexVars, isVariable } from 'generaltranslation/internal';
import { stringifySortedJson } from '../../fs/sortedJson.js';
import { isRecord, ownValue } from '../catalogs.js';
import type { ConversionResult, LegacyDataFormat } from '../types.js';
import { canonicalizeTree, mapBranches, mapTree } from './tree.js';

const DECLARED_VARIABLE = /^_gt_\d+$/;
const DECLARED_VARIABLE_KEYS = new Set(['other', '_gt_var_name']);
const PLURAL_CATEGORIES = new Set([
  'zero',
  'one',
  'two',
  'few',
  'many',
  'other',
]);
const LEGACY_PLURAL_ALIASES: Record<string, string> = {
  singular: 'one',
  dual: 'two',
};
const EXACT_VALUE_CATEGORIES: [category: string, value: number][] = [
  ['zero', 0],
  ['one', 1],
  ['two', 2],
];
const DERIVE_COMPONENT = 'Derive';
const PERCENT_STEMS = new Set(['percent', '%']);

/**
 * How a converted `<Plural>` keeps the legacy rule that `zero`, `one` and
 * `two` win for exactly 0, 1 and 2 in any locale: `add` copies them to
 * `=N` keys, `replace` renames them.
 */
export type GtjsxOptions = {
  locale?: string;
  exactValues?: 'add' | 'replace';
};

class UnsupportedContent extends Error {}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function invalidTreeReason({
  path,
  message,
}: MessageTreeValidationError): string {
  return `Not a valid message tree at ${JSON.stringify(path)}: ${message}`;
}

function converted(
  tree: MessageTree,
  formats: MessageFormats
): ConversionResult {
  const canonical = canonicalizeTree(tree);
  const error = validateMessageTree(canonical);
  return error
    ? { ok: false, reason: invalidTreeReason(error) }
    : { ok: true, tree: canonical, formats };
}

function rewriteDeclaredVariables(tree: MessageTree): MessageTree {
  return mapTree(tree, (node): MessageNode => {
    switch (node[1]) {
      case 'select': {
        const keys = Object.keys(node[2]);
        if (
          DECLARED_VARIABLE.test(node[0]) &&
          keys.includes('other') &&
          keys.every((key) => DECLARED_VARIABLE_KEYS.has(key))
        ) {
          return [node[0]];
        }
        return [
          node[0],
          'select',
          mapBranches(node[2], rewriteDeclaredVariables),
        ];
      }
      case 'plural':
      case 'selectordinal': {
        const branches = mapBranches(node[2], rewriteDeclaredVariables);
        return node[3]
          ? [node[0], node[1], branches, node[3]]
          : [node[0], node[1], branches];
      }
      case 'tag':
        return [node[0], 'tag', rewriteDeclaredVariables(node[2])];
      default:
        return node;
    }
  });
}

const PERCENT_MARK = /^__gt_migrate_percent_\d+_(.+)$/;

/** Renames each number argument written `::percent` or `::%`, which the legacy runtime scaled by 100 like the `percent` style, so the occurrence can be found in the tree. */
function markPercentSkeletons(icu: string): string {
  const ast = parse(icu);
  let count = 0;
  const walk = (elements: MessageFormatElement[]) => {
    for (const element of elements) {
      if (
        element.type === TYPE.number &&
        typeof element.style === 'object' &&
        element.style?.tokens.some((token) => PERCENT_STEMS.has(token.stem))
      ) {
        element.value = `__gt_migrate_percent_${count++}_${element.value}`;
      } else if (element.type === TYPE.plural || element.type === TYPE.select) {
        for (const option of Object.values(element.options)) {
          walk(option.value);
        }
      } else if (element.type === TYPE.tag) {
        walk(element.children);
      }
    }
  };
  walk(ast);
  return count ? printAST(ast) : icu;
}

function unmarkPercentSkeletons(tree: MessageTree): MessageTree {
  return mapTree(tree, (node): MessageNode => {
    switch (node[1]) {
      case 'number': {
        const original = PERCENT_MARK.exec(node[0])?.[1];
        return original === undefined ? node : [original, 'number', 'percent'];
      }
      case 'select':
        return [
          node[0],
          'select',
          mapBranches(node[2], unmarkPercentSkeletons),
        ];
      case 'plural':
      case 'selectordinal': {
        const branches = mapBranches(node[2], unmarkPercentSkeletons);
        return node[3]
          ? [node[0], node[1], branches, node[3]]
          : [node[0], node[1], branches];
      }
      case 'tag':
        return [node[0], 'tag', unmarkPercentSkeletons(node[2])];
      default:
        return node;
    }
  });
}

/** A variable's formatted occurrences must share one formatting context, an absent one counting as empty, as `icuToMessage` requires. */
function unmarkFormats(
  markedTree: MessageTree,
  formats: MessageFormats
): MessageFormats {
  const contexts = new Map<string, string>();
  const merged = new Map<string, MessageFormats[string]>();
  forEachPlaceholder(markedTree, (node) => {
    if (node[1] !== 'number' && node[1] !== 'date' && node[1] !== 'time') {
      return;
    }
    const original = PERCENT_MARK.exec(node[0])?.[1] ?? node[0];
    const context = ownValue(formats, node[0]);
    const key = stringifySortedJson(context ?? {}, 0);
    const known = contexts.get(original);
    if (known !== undefined && known !== key) {
      throw new Error(
        `Message variable "${original}" is formatted with different formatting context in one message; give each its own variable name.`
      );
    }
    contexts.set(original, key);
    if (context) merged.set(original, context);
  });
  return Object.fromEntries(merged);
}

/** Converts a legacy `gt()`, `msg()` or dictionary ICU string, rewriting each declared variable to an argument. */
export function legacyIcuToMessage(icu: string): ConversionResult {
  try {
    const { tree, formats } = icuToMessage(
      markPercentSkeletons(indexVars(icu))
    );
    return converted(
      unmarkPercentSkeletons(rewriteDeclaredVariables(tree)),
      unmarkFormats(tree, formats)
    );
  } catch (error) {
    return { ok: false, reason: errorText(error) };
  }
}

function jsxNodes(children: unknown, options: GtjsxOptions): MessageNode[] {
  return Array.isArray(children)
    ? children.flatMap((child: unknown) =>
        Array.isArray(child) ? unsupported(child) : jsxChild(child, options)
      )
    : jsxChild(children, options);
}

function unsupported(child: unknown): never {
  throw new UnsupportedContent(
    `Unsupported JSX content ${JSON.stringify(child)}`
  );
}

function jsxChild(child: unknown, options: GtjsxOptions): MessageNode[] {
  if (typeof child === 'string') return [child];
  if (child === null || child === undefined || typeof child === 'boolean') {
    return [];
  }
  if (!isRecord(child)) return unsupported(child);
  if (isVariable(child)) return [variableNode(child.k, child.v)];
  if (child.t === DERIVE_COMPONENT && child.d === undefined) {
    return jsxNodes(child.c, options);
  }
  return [branchingNode(child, options)];
}

function variableNode(name: string, kind: string | undefined): MessageNode {
  switch (kind) {
    case undefined:
    case 'v':
      return [name];
    case 'n':
      return [name, 'number'];
    case 'c':
      return [name, 'number', 'currency'];
    case 'd':
      return [name, 'date'];
    case 'rt':
      throw new UnsupportedContent(
        `<RelativeTime> variable "${name}" has no message tree form`
      );
    default:
      throw new UnsupportedContent(
        `Variable "${name}" has the unknown type "${kind}"`
      );
  }
}

function branchingNode(
  element: Record<string, unknown>,
  options: GtjsxOptions
): MessageNode {
  const data = element.d;
  const kind = isRecord(data) ? data.t : undefined;
  if (!isRecord(data) || (kind !== 'p' && kind !== 'b')) {
    const tag = typeof element.t === 'string' ? `<${element.t}>` : 'an element';
    throw new UnsupportedContent(
      `It contains ${tag}; only <Plural> and <Branch> elements have a message tree form`
    );
  }
  const attributes = Object.keys(data).filter(
    (key) => key !== 't' && key !== 'b'
  );
  if (attributes.length) {
    throw new UnsupportedContent(
      `It contains an element with translatable attributes (${attributes.join(', ')})`
    );
  }
  if (typeof element.i !== 'number') {
    throw new UnsupportedContent(
      'It contains a <Plural> or <Branch> without an id'
    );
  }
  const branches = data.b ?? {};
  if (!isRecord(branches)) return unsupported(element);
  const isPlural = kind === 'p';
  const trees: Record<string, MessageTree> = isPlural
    ? pluralBranches(branches, options)
    : Object.fromEntries(
        Object.entries(branches).map(([key, branch]) => [
          key,
          jsxNodes(branch, options),
        ])
      );
  if (!Object.prototype.hasOwnProperty.call(trees, 'other')) {
    trees.other = jsxNodes(element.c, options);
  }
  const name = `_gt_${isPlural ? 'plural' : 'branch'}_${element.i}`;
  return [name, isPlural ? 'plural' : 'select', trees];
}

function pluralBranches(
  branches: Record<string, unknown>,
  options: GtjsxOptions
): Record<string, MessageTree> {
  const trees: Record<string, MessageTree> = {};
  const aliased: [string, unknown][] = [];
  let fallback: MessageTree | undefined;
  for (const [key, branch] of Object.entries(branches)) {
    if (key === 'plural') {
      fallback = jsxNodes(branch, options);
    } else if (key in LEGACY_PLURAL_ALIASES) {
      aliased.push([LEGACY_PLURAL_ALIASES[key], branch]);
    } else if (PLURAL_CATEGORIES.has(key)) {
      trees[key] = jsxNodes(branch, options);
    } else {
      throw new UnsupportedContent(
        `<Plural> branch "${key}" is not an ICU plural category`
      );
    }
  }
  for (const [category, branch] of aliased) {
    trees[category] = jsxNodes(branch, options);
  }
  const rules = options.locale ? pluralRulesFor(options.locale) : undefined;
  if (fallback !== undefined) {
    if (!has(trees, 'other')) trees.other = fallback;
    for (const category of rules?.resolvedOptions().pluralCategories ?? []) {
      if (!has(trees, category)) trees[category] = fallback;
    }
  }
  if (!rules || !options.exactValues) return trees;
  for (const [category, value] of EXACT_VALUE_CATEGORIES) {
    if (!has(trees, category)) continue;
    const branch = trees[category];
    if (rules.select(value) !== category) trees[`=${value}`] ??= branch;
    if (
      options.exactValues === 'add' &&
      value > 0 &&
      rules.select(-value) !== category
    ) {
      trees[`=-${value}`] ??= branch;
    }
    if (options.exactValues === 'replace' && rules.select(value) !== category) {
      delete trees[category];
    }
  }
  return trees;
}

function has(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function pluralRulesFor(locale: string): Intl.PluralRules | undefined {
  try {
    return new Intl.PluralRules(locale);
  } catch {
    return undefined;
  }
}

/** `<Plural>` and `<Branch>` variables are named from the element id, since GTJSX does not record them. */
export function gtjsxToMessage(
  jsx: unknown,
  options: GtjsxOptions = {}
): ConversionResult {
  try {
    return converted(jsxNodes(jsx, options), {});
  } catch (error) {
    if (error instanceof UnsupportedContent) {
      return { ok: false, reason: error.message };
    }
    throw error;
  }
}

export function convertLegacyValue(
  value: unknown,
  dataFormat: LegacyDataFormat,
  locale?: string
): ConversionResult {
  switch (dataFormat) {
    case 'ICU':
      return typeof value === 'string'
        ? legacyIcuToMessage(value)
        : { ok: false, reason: 'An ICU message must be a string' };
    case 'STRING':
      return typeof value === 'string'
        ? { ok: true, tree: value, formats: {} }
        : { ok: false, reason: 'A STRING message must be a string' };
    case 'JSX':
      return gtjsxToMessage(value, { locale, exactValues: 'add' });
    case 'MESSAGE_TREE': {
      const error = validateMessageTree(value);
      return error
        ? { ok: false, reason: invalidTreeReason(error) }
        : {
            ok: true,
            tree: canonicalizeTree(value as MessageTree),
            formats: {},
          };
    }
  }
}
