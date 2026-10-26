import type {
  JsxChild,
  JsxChildren,
  JsxElement,
  Variable,
} from '@generaltranslation/format/types';
import {
  getPluralForm,
  isAcceptedPluralForm,
  isVariable,
} from 'generaltranslation/internal';
import type { Snippet } from 'svelte';

/** Runtime metadata emitted by the gt-svelte preprocessor as `_gtm`. */
export type GTRuntimeMetadata = {
  /** Per scope: variable key -> variable id. */
  v?: Record<string, Record<string, number>>;
  /** Per scoped element id: Branch/Plural kind and source branch names. */
  b?: Record<string, { t: 'p' | 'b'; b: string[] }>;
};

/** Everything `GtNodes` needs to resolve target nodes to source snippets. */
export type RenderContext = {
  /** Props passed to `<T>`, including the generated snippets. */
  snippets: Record<string, unknown>;
  meta: GTRuntimeMetadata;
  /** Locales used to pick plural forms: the active locale, then the default. */
  locales: string[];
};

export type ElementSnippet = Snippet<[Snippet, JsxElement['d']]>;
export type VariableSnippet = Snippet<[]>;
export type BranchSnippet = Snippet<[Snippet<[unknown]>]>;

export type RenderItem =
  | { kind: 'text'; key: string; text: string }
  | { kind: 'variable'; key: string; snippet: VariableSnippet }
  | {
      kind: 'element';
      key: string;
      snippet: ElementSnippet;
      node: JsxElement;
    }
  | {
      kind: 'branch';
      key: string;
      snippet: BranchSnippet;
      node: JsxElement;
      /** Scopes the branch element itself resolves in. */
      scopes: string[];
      /** Scoped id of the branch element, used to find its metadata. */
      scopedId: string;
    };

const ELEMENT_PREFIX = '__gt_e_';
const VARIABLE_PREFIX = '__gt_v_';

/**
 * Converts translated JSX children into keyed render items. Elements are
 * keyed by id and variables by key, so a reordering translation moves
 * existing DOM nodes instead of recreating them. Repeated references get an
 * occurrence suffix. Nodes that cannot be resolved are skipped; `<T>`
 * validates the whole target first, so this only happens for a branch
 * paired with a different source branch.
 */
export function toRenderItems(
  nodes: JsxChildren | undefined,
  scopes: string[],
  context: RenderContext
): RenderItem[] {
  const items: RenderItem[] = [];
  const occurrences = new Map<string, number>();
  const uniqueKey = (key: string) => {
    const count = occurrences.get(key) ?? 0;
    occurrences.set(key, count + 1);
    return count === 0 ? key : `${key}#${count}`;
  };

  toArray(nodes).forEach((node, index) => {
    if (typeof node === 'string') {
      items.push({ kind: 'text', key: `s${index}`, text: node });
      return;
    }
    if (isVariable(node)) {
      const snippet = resolveVariable(node, scopes, context);
      if (snippet) {
        items.push({
          kind: 'variable',
          key: uniqueKey(`v${node.k}`),
          snippet,
        });
      }
      return;
    }
    if (!isElement(node)) return;
    const resolved = resolveElement(node.i, scopes, context);
    if (!resolved) return;
    const key = uniqueKey(`e${node.i}`);
    if (context.meta.b?.[resolved.scopedId]) {
      items.push({
        kind: 'branch',
        key,
        snippet: resolved.snippet as BranchSnippet,
        node,
        scopes,
        scopedId: resolved.scopedId,
      });
    } else {
      items.push({
        kind: 'element',
        key,
        snippet: resolved.snippet as ElementSnippet,
        node,
      });
    }
  });
  return items;
}

/**
 * Picks the translated branch to render for a Branch/Plural element, along
 * with the source scopes its elements and variables resolve in.
 */
export function selectBranch(
  item: Extract<RenderItem, { kind: 'branch' }>,
  value: unknown,
  context: RenderContext
): { nodes: JsxChildren | undefined; scopes: string[] } {
  const { node, scopes, scopedId } = item;
  const info = context.meta.b?.[scopedId];
  const targetBranches = node.d?.b ?? {};
  const fallback = { nodes: node.c, scopes };
  if (!info) return fallback;

  let sourceBranch: string | undefined;
  let targetBranch: string | undefined;
  if (info.t === 'p') {
    if (typeof value !== 'number') return fallback;
    sourceBranch = pickPluralForm(value, info.b, context.locales);
    targetBranch = pickPluralForm(
      value,
      Object.keys(targetBranches),
      context.locales
    );
  } else {
    const key = value == null || value === '' ? undefined : String(value);
    sourceBranch = key && info.b.includes(key) ? key : undefined;
    targetBranch = key && key in targetBranches ? key : undefined;
  }

  if (targetBranch === undefined) return fallback;
  return {
    nodes: targetBranches[targetBranch],
    scopes: getBranchScopes(item, info.b, sourceBranch),
  };
}

/**
 * Checks that every element and variable in a translation resolves to a
 * generated snippet. Branch content is checked against every source branch
 * it could be paired with.
 */
export function validateTarget(
  nodes: JsxChildren | undefined,
  scopes: string[],
  context: RenderContext
): boolean {
  for (const node of toArray(nodes)) {
    if (typeof node === 'string') continue;
    if (isVariable(node)) {
      if (!resolveVariable(node, scopes, context)) return false;
      continue;
    }
    if (!isElement(node)) return false;
    const resolved = resolveElement(node.i, scopes, context);
    if (!resolved) return false;
    const info = context.meta.b?.[resolved.scopedId];
    if (info) {
      const branchScopes = [
        ...info.b.map((name) => `${resolved.scope}b${node.i}$${name}$`),
        ...scopes,
      ];
      for (const branch of Object.values(node.d?.b ?? {})) {
        if (!validateTarget(branch, branchScopes, context)) return false;
      }
    }
    if (node.c != null && !validateTarget(node.c, scopes, context)) {
      return false;
    }
  }
  return true;
}

// ===== Helpers ===== //

function getBranchScopes(
  item: Extract<RenderItem, { kind: 'branch' }>,
  sourceBranches: string[],
  sourceBranch: string | undefined
): string[] {
  const branchScope = (scope: string, name: string) =>
    `${scope}b${item.node.i}$${name}$`;
  const ownerScope = item.scopedId.slice(
    0,
    item.scopedId.length - String(item.node.i).length
  );
  const ordered = sourceBranch
    ? [sourceBranch, ...sourceBranches.filter((name) => name !== sourceBranch)]
    : sourceBranches;
  return [
    ...ordered.map((name) => branchScope(ownerScope, name)),
    ...item.scopes,
  ];
}

function pickPluralForm(
  n: number,
  branches: string[],
  locales: string[]
): string | undefined {
  const forms = branches.filter(isAcceptedPluralForm);
  if (forms.length === 0) return undefined;
  return getPluralForm(n, forms, locales) || undefined;
}

function resolveElement(
  id: number | undefined,
  scopes: string[],
  context: RenderContext
): { snippet: unknown; scope: string; scopedId: string } | undefined {
  if (typeof id !== 'number') return undefined;
  for (const scope of scopes) {
    const snippet = context.snippets[`${ELEMENT_PREFIX}${scope}${id}`];
    if (typeof snippet === 'function') {
      return { snippet, scope, scopedId: `${scope}${id}` };
    }
  }
  return undefined;
}

function resolveVariable(
  node: Variable,
  scopes: string[],
  context: RenderContext
): VariableSnippet | undefined {
  for (const scope of scopes) {
    const id = context.meta.v?.[scope]?.[node.k];
    if (id === undefined) continue;
    const snippet = context.snippets[`${VARIABLE_PREFIX}${scope}${id}`];
    if (typeof snippet === 'function') return snippet as VariableSnippet;
  }
  return undefined;
}

function toArray(nodes: JsxChildren | undefined): JsxChild[] {
  if (nodes == null || typeof nodes === 'boolean') return [];
  return (Array.isArray(nodes) ? nodes : [nodes]).filter(
    (node): node is JsxChild => node != null && typeof node !== 'boolean'
  );
}

function isElement(node: JsxChild): node is JsxElement {
  return typeof node === 'object' && typeof (node as JsxElement).i === 'number';
}
