import { hashSource } from 'generaltranslation/id';
import type { GTBindings } from './imports.js';
import { getStaticExpressionValue } from './translation.js';
import type { SvelteNode, TranslationMetadata } from './types.js';

export type StringCall = {
  source: string;
  hash: string;
  metadata: TranslationMetadata;
  offset: number;
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
): { calls: StringCall[]; problems: StringProblem[] } {
  const calls: StringCall[] = [];
  const problems: StringProblem[] = [];
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
    if (
      !isNamedCallee(node, gtNames) &&
      !isNamedCallee(node, msgNames, bindings.namespaces, 'msg')
    ) {
      return;
    }
    const [message, options] = node.arguments as SvelteNode[];
    const source = message && getStaticExpressionValue(message);
    if (typeof source !== 'string') {
      problems.push({
        offset: node.start,
        whatHappened: 'Translated strings must be string literals',
        fix: 'Pass a string literal and supply dynamic values as ICU variables in the options',
      });
      return;
    }
    const metadata = readStringOptions(options, problems);
    if (metadata === null) return;
    calls.push({
      source,
      metadata,
      offset: node.start,
      hash: hashSource({
        source,
        ...(metadata.context && { context: metadata.context }),
        ...(metadata.maxChars != null && {
          maxChars: Math.abs(metadata.maxChars),
        }),
        ...(metadata.requiresReview === true && { requiresReview: true }),
        dataFormat: 'ICU',
      }),
    });
  });

  return { calls, problems };
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
        if (typeof staticValue !== 'number') {
          problems.push({
            offset: property.start,
            whatHappened: `The "${name}" option must be a static number`,
          });
          return null;
        }
        metadata.maxChars = staticValue;
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
