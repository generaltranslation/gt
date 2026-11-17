import {
  validateMessageTree,
  type MessageFormats,
  type MessageNode,
  type MessageTree,
  type MessageTreeValidationError,
} from '@generaltranslation/icu';
import { icuToMessage } from '@generaltranslation/icu/convert';
import { indexVars, isVariable } from 'generaltranslation/internal';
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
const PERCENT_SKELETON = /::\s*percent\b/;
const UNIT_PERCENT = /unit\/percent\b/;

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

function rewritePercentSkeletons(tree: MessageTree): MessageTree {
  return mapTree(tree, (node): MessageNode => {
    switch (node[1]) {
      case 'number': {
        const style = node[2];
        return typeof style === 'object' &&
          style.style === 'unit' &&
          style.unit === 'percent'
          ? [node[0], 'number', 'percent']
          : node;
      }
      case 'select':
        return [
          node[0],
          'select',
          mapBranches(node[2], rewritePercentSkeletons),
        ];
      case 'plural':
      case 'selectordinal': {
        const branches = mapBranches(node[2], rewritePercentSkeletons);
        return node[3]
          ? [node[0], node[1], branches, node[3]]
          : [node[0], node[1], branches];
      }
      case 'tag':
        return [node[0], 'tag', rewritePercentSkeletons(node[2])];
      default:
        return node;
    }
  });
}

/** Converts a legacy `gt()`, `msg()` or dictionary ICU string, rewriting each declared variable to an argument. */
export function legacyIcuToMessage(icu: string): ConversionResult {
  try {
    const { tree, formats } = icuToMessage(indexVars(icu));
    const rewritten = rewriteDeclaredVariables(tree);
    return converted(
      PERCENT_SKELETON.test(icu) && !UNIT_PERCENT.test(icu)
        ? rewritePercentSkeletons(rewritten)
        : rewritten,
      formats
    );
  } catch (error) {
    return { ok: false, reason: errorText(error) };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
  for (const [key, branch] of Object.entries(branches)) {
    if (key === 'plural' || key in LEGACY_PLURAL_ALIASES) {
      aliased.push([LEGACY_PLURAL_ALIASES[key] ?? 'other', branch]);
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
  if (!options.locale || !options.exactValues) return trees;
  const rules = pluralRulesFor(options.locale);
  for (const [category, value] of EXACT_VALUE_CATEGORIES) {
    if (!Object.prototype.hasOwnProperty.call(trees, category)) continue;
    if (rules?.select(value) === category) continue;
    trees[`=${value}`] ??= trees[category];
    if (options.exactValues === 'replace') delete trees[category];
  }
  return trees;
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
