import { parse as parseIcu } from '@generaltranslation/icu/parser';
import { hashSource } from 'generaltranslation/id';
import type { StringFormat } from '@generaltranslation/format/types';
import type { GTBindings } from './imports.js';
import { getStaticExpressionValue } from './translation.js';
import type { SvelteNode, TranslationMetadata } from './types.js';

export type StringCall = {
  source: string;
  hash: string;
  /** The `$format` option, which the runtime hashes with. */
  dataFormat: StringFormat;
  metadata: TranslationMetadata;
  offset: number;
  end: number;
};

export type StringProblem = {
  whatHappened: string;
  fix?: string;
  offset: number;
};

const SKIPPED_KEYS = new Set(['metadata', 'loc', 'name_loc', 'parent']);

/**
 * Finds `gt('...')` calls (where `gt` comes from `useGT()`) and `msg('...')`
 * calls in a component's scripts and template expressions.
 */
export function collectStringCalls(
  root: unknown,
  bindings: GTBindings
): {
  calls: StringCall[];
  problems: StringProblem[];
  warnings: StringProblem[];
} {
  const calls: StringCall[] = [];
  const problems: StringProblem[] = [];
  const warnings: StringProblem[] = [];
  const msgNames = new Set<string>();
  const useGTNames = new Set<string>();
  for (const [local, kind] of bindings.functions) {
    (kind === 'msg' ? msgNames : useGTNames).add(local);
  }

  // gt functions are the variables initialized from useGT()
  const gtNames = new Set<string>();
  walk(root, (node) => {
    if (node.type !== 'VariableDeclarator') return;
    const init = node.init as SvelteNode | null;
    const id = node.id as SvelteNode & { name?: string };
    if (
      id.type === 'Identifier' &&
      init?.type === 'CallExpression' &&
      isNamedCallee(init, useGTNames, bindings.namespaces, 'useGT')
    ) {
      gtNames.add(id.name as string);
    }
  });

  walk(root, (node) => {
    if (node.type !== 'CallExpression') return;
    const isMsg = isNamedCallee(node, msgNames, bindings.namespaces, 'msg');
    if (!isMsg && !isNamedCallee(node, gtNames)) return;
    const [message, options] = node.arguments as SvelteNode[];
    const metadata = readStringOptions(options, problems);
    if (metadata === null) return;
    const dataFormat = readStringFormat(options, problems);
    if (dataFormat === null) return;

    // msg() also registers an array of messages, each with an indexed id.
    const messages: { node: SvelteNode | undefined; index?: number }[] =
      isMsg && message?.type === 'ArrayExpression'
        ? (message.elements as (SvelteNode | null)[]).flatMap(
            (element, index) => (element ? [{ node: element, index }] : [])
          )
        : [{ node: message }];

    for (const { node: messageNode, index } of messages) {
      const source = messageNode ? getStaticMessage(messageNode) : undefined;
      if (!messageNode || source === undefined) {
        problems.push({
          offset: index === undefined ? node.start : messageNode!.start,
          whatHappened: 'Translated strings must be string literals',
          fix: 'Pass a string literal and supply dynamic values as ICU variables in the options',
        });
        continue;
      }
      if (dataFormat === 'ICU') {
        const icuError = getIcuError(source);
        if (icuError) {
          warnings.push({
            offset: messageNode.start,
            whatHappened: `Found invalid ICU string ${JSON.stringify(source)}, so it was not extracted (${icuError})`,
            fix: 'Change it to a valid ICU message so it can be translated',
          });
          continue;
        }
      }
      const siteMetadata =
        index !== undefined && metadata.id
          ? { ...metadata, id: `${metadata.id}.${index}` }
          : metadata;
      calls.push({
        source,
        metadata: siteMetadata,
        dataFormat,
        offset: node.start,
        end: node.end,
        hash: hashSource({
          source,
          ...(metadata.context && { context: metadata.context }),
          ...(metadata.maxChars != null && { maxChars: metadata.maxChars }),
          ...(metadata.requiresReview === true && { requiresReview: true }),
          dataFormat,
        }),
      });
    }
  });

  return { calls, problems, warnings };
}

/**
 * Evaluates a message: a static string, or a `+` concatenation of static
 * strings and numbers that evaluates to a string at runtime.
 */
function getStaticMessage(expression: SvelteNode): string | undefined {
  const value = evaluateConcatenation(expression);
  return typeof value === 'string' ? value : undefined;
}

function evaluateConcatenation(
  expression: SvelteNode
): string | number | undefined {
  if (
    expression.type !== 'BinaryExpression' ||
    (expression as { operator?: string }).operator !== '+'
  ) {
    return getStaticExpressionValue(expression);
  }
  const left = evaluateConcatenation(expression.left as SvelteNode);
  const right = evaluateConcatenation(expression.right as SvelteNode);
  if (left === undefined || right === undefined) return undefined;
  if (typeof left === 'number' && typeof right === 'number') {
    return left + right;
  }
  return `${left}${right}`;
}

/** Returns the ICU parser's error for an invalid message. */
function getIcuError(source: string): string | undefined {
  try {
    parseIcu(source);
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

const STRING_FORMATS: readonly StringFormat[] = ['ICU', 'I18NEXT', 'STRING'];

/**
 * Reads the `$format` option, which defaults to ICU like `useGT()` and
 * `msg()`. Returns `null` and reports a problem when it is not static.
 */
function readStringFormat(
  options: SvelteNode | undefined,
  problems: StringProblem[]
): StringFormat | null {
  if (!options || options.type !== 'ObjectExpression') return 'ICU';
  for (const property of options.properties as SvelteNode[]) {
    if (property.type !== 'Property' || property.computed) continue;
    const key = property.key as SvelteNode & { name?: string; value?: unknown };
    const name = key.type === 'Identifier' ? key.name : key.value;
    if (name !== '$format') continue;
    const value = getStaticExpressionValue(property.value as SvelteNode);
    if (!STRING_FORMATS.includes(value as StringFormat)) {
      problems.push({
        offset: property.start,
        whatHappened: `The "$format" option must be one of ${STRING_FORMATS.map((format) => `"${format}"`).join(', ')}`,
      });
      return null;
    }
    return value as StringFormat;
  }
  return 'ICU';
}

function readStringOptions(
  options: SvelteNode | undefined,
  problems: StringProblem[]
): TranslationMetadata | null {
  const metadata: TranslationMetadata = {};
  if (!options || options.type !== 'ObjectExpression') return metadata;
  for (const property of options.properties as SvelteNode[]) {
    if (property.type !== 'Property' || property.computed) continue;
    const key = property.key as SvelteNode & { name?: string; value?: unknown };
    const name =
      key.type === 'Identifier' ? (key.name ?? '') : String(key.value ?? '');
    const field = name.startsWith('$') ? name.slice(1) : name;
    const value = property.value as SvelteNode & { value?: unknown };
    switch (field) {
      case 'context':
      case 'id': {
        // Unprefixed names double as ICU variables, so only $-prefixed
        // options are treated as metadata.
        if (!name.startsWith('$')) break;
        const staticValue = getStaticExpressionValue(value);
        if (typeof staticValue !== 'string') {
          problems.push({
            offset: property.start,
            whatHappened: `The "${name}" option must be a static string`,
          });
          return null;
        }
        metadata[field] = staticValue;
        break;
      }
      case 'maxChars': {
        if (!name.startsWith('$')) break;
        const staticValue = getStaticExpressionValue(value);
        if (!Number.isInteger(staticValue)) {
          problems.push({
            offset: property.start,
            whatHappened: `The "${name}" option must be a static integer`,
          });
          return null;
        }
        // The sign is ignored, as at runtime.
        metadata.maxChars = Math.abs(staticValue as number);
        break;
      }
      case 'requiresReview': {
        if (!name.startsWith('$')) break;
        if (value.type !== 'Literal' || typeof value.value !== 'boolean') {
          problems.push({
            offset: property.start,
            whatHappened: `The "${name}" option must be a static boolean`,
          });
          return null;
        }
        if (value.value) metadata.requiresReview = true;
        break;
      }
    }
  }
  return metadata;
}

function isNamedCallee(
  call: SvelteNode,
  names: Set<string>,
  namespaces?: Set<string>,
  member?: string
): boolean {
  const callee = call.callee as SvelteNode & { name?: string };
  if (callee.type === 'Identifier') return names.has(callee.name as string);
  if (
    namespaces &&
    member &&
    callee.type === 'MemberExpression' &&
    !callee.computed
  ) {
    const object = callee.object as SvelteNode & { name?: string };
    const property = callee.property as SvelteNode & { name?: string };
    return (
      object.type === 'Identifier' &&
      namespaces.has(object.name as string) &&
      property.name === member
    );
  }
  return false;
}

function walk(value: unknown, visit: (node: SvelteNode) => void): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit);
    return;
  }
  const node = value as SvelteNode;
  if (typeof node.type === 'string') visit(node);
  for (const key in node) {
    if (SKIPPED_KEYS.has(key)) continue;
    const child = node[key];
    if (child && typeof child === 'object') walk(child, visit);
  }
}
