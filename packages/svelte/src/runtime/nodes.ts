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
import type { GTRuntimeMetadata } from '@generaltranslation/svelte-extractor';
import type { Snippet } from 'svelte';

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
      /** Scoped id of the element, the parent of its children. */
      scopedId: string;
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
 * Converts translated JSX children into keyed render items. Elements and
 * variables are keyed by the scoped id of the source node they resolve to,
 * so a reordering translation moves existing DOM nodes instead of
 * recreating them. Repeated references get an occurrence suffix. Nodes that
 * cannot be resolved are skipped; `<T>` validates the whole target first,
 * so this only happens for a branch paired with a different source branch.
 */
export function toRenderItems(
  nodes: JsxChildren | undefined,
  scopes: string[],
  parent: string,
  context: RenderContext
): RenderItem[] {
  const items: RenderItem[] = [];
  const occurrences = new Map<string, number>();
  // Scoped ids are made of numeric ids, `b`, `_`, and `$`, so they never
  // contain `#`.
  const uniqueKey = (base: string) => {
    const count = occurrences.get(base) ?? 0;
    occurrences.set(base, count + 1);
    return count === 0 ? base : `${base}#${count}`;
  };

  toArray(nodes).forEach((node, index) => {
    if (typeof node === 'string') {
      items.push({ kind: 'text', key: `s${index}`, text: node });
      return;
    }
    if (isVariable(node)) {
      const resolved = resolveVariable(node, scopes, parent, context);
      if (resolved) {
        items.push({
          kind: 'variable',
          key: uniqueKey(`v${resolved.scopedId}`),
          snippet: resolved.snippet,
        });
      }
      return;
    }
    if (!isElement(node)) return;
    const resolved = resolveElement(node.i, scopes, context);
    if (!resolved) return;
    const key = uniqueKey(`e${resolved.scopedId}`);
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
        scopedId: resolved.scopedId,
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
  const targetBranches = getBranches(node) ?? {};
  const fallback = { nodes: node.c, scopes };
  if (!info) return fallback;

  let sourceBranch: string | undefined;
  let targetBranch: string | undefined;
  if (info.t === 'p') {
    if (typeof value !== 'number') return fallback;
    targetBranch = pickPluralForm(
      value,
      Object.keys(targetBranches),
      context.locales
    );
    // Pair the form with its same-named source form, as validateTarget()
    // does, and only fall back to the source form for `n` when the source
    // has no such form.
    sourceBranch =
      targetBranch !== undefined && info.b.includes(targetBranch)
        ? targetBranch
        : pickPluralForm(value, info.b, context.locales);
  } else {
    const key = value == null || value === '' ? undefined : String(value);
    sourceBranch = key && info.b.includes(key) ? key : undefined;
    targetBranch = key && Object.hasOwn(targetBranches, key) ? key : undefined;
  }

  if (targetBranch === undefined) return fallback;
  const ownerScope = scopedId.slice(0, scopedId.length - String(node.i).length);
  return {
    nodes: targetBranches[targetBranch],
    scopes: getBranchScopes(ownerScope, node, info.b, sourceBranch, scopes),
  };
}

/**
 * Checks that every element and variable in a translation resolves to a
 * generated snippet. Branch content is checked in the scopes of every
 * source branch selectBranch() can pair it with.
 */
export function validateTarget(
  nodes: JsxChildren | undefined,
  scopes: string[],
  context: RenderContext,
  parent = ''
): boolean {
  for (const node of toArray(nodes)) {
    if (typeof node === 'string') continue;
    if (isVariable(node)) {
      if (!resolveVariable(node, scopes, parent, context)) return false;
      continue;
    }
    if (!isElement(node)) return false;
    const resolved = resolveElement(node.i, scopes, context);
    if (!resolved) return false;
    const info = context.meta.b?.[resolved.scopedId];
    if (info) {
      const branches = getBranches(node);
      if (branches === null) return false;
      for (const [name, branch] of Object.entries(branches ?? {})) {
        for (const pairing of getPairedSourceBranches(info, name)) {
          const branchScopes = getBranchScopes(
            resolved.scope,
            node,
            info.b,
            pairing,
            scopes
          );
          if (
            !validateTarget(branch, branchScopes, context, resolved.scopedId)
          ) {
            return false;
          }
        }
      }
    }
    if (
      node.c != null &&
      !validateTarget(node.c, scopes, context, resolved.scopedId)
    ) {
      return false;
    }
  }
  return true;
}

// ===== Helpers ===== //

/**
 * Returns a Branch/Plural element's translated branches: `undefined` when
 * it has none, and `null` when they are not a plain object.
 */
function getBranches(
  node: JsxElement
): Record<string, JsxChildren> | undefined | null {
  const branches: unknown = node.d?.b;
  if (branches == null) return undefined;
  if (typeof branches !== 'object' || Array.isArray(branches)) return null;
  return branches as Record<string, JsxChildren>;
}

/**
 * Returns the source branches selectBranch() can pair a translated branch
 * with: its same-named source branch, or for a plural form the source does
 * not have, any source form `n` can select. `undefined` pairs with none.
 */
function getPairedSourceBranches(
  info: { t: 'p' | 'b'; b: string[] },
  name: string
): (string | undefined)[] {
  if (info.b.includes(name)) return [name];
  return info.t === 'p' ? [...info.b, undefined] : [undefined];
}

/**
 * Returns the scopes a Branch/Plural element's branch content resolves in:
 * the paired source branch first, then its siblings, then the scopes the
 * element itself resolves in.
 */
function getBranchScopes(
  ownerScope: string,
  node: JsxElement,
  sourceBranches: string[],
  sourceBranch: string | undefined,
  scopes: string[]
): string[] {
  // Branch scopes are named after the branch's position in the source,
  // as the preprocessor names them.
  const indexes = sourceBranches.map((_, index) => index);
  const paired = sourceBranch ? sourceBranches.indexOf(sourceBranch) : -1;
  const ordered =
    paired === -1
      ? indexes
      : [paired, ...indexes.filter((index) => index !== paired)];
  return [
    ...ordered.map((index) => `${ownerScope}b${node.i}_${index}$`),
    ...scopes,
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
  parent: string,
  context: RenderContext
): { snippet: VariableSnippet; scopedId: string } | undefined {
  // A key used more than once in a scope resolves among the parent's source
  // children first, like gt-react. Scopes end in `$`, ids are digits.
  const siblingId = getOwn(context.meta.s?.[parent], node.k);
  if (siblingId !== undefined) {
    const scopedId = `${parent.replace(/\d+$/, '')}${siblingId}`;
    const snippet = context.snippets[`${VARIABLE_PREFIX}${scopedId}`];
    if (typeof snippet === 'function') {
      return { snippet: snippet as VariableSnippet, scopedId };
    }
  }
  for (const scope of scopes) {
    const id = getOwn(context.meta.v?.[scope], node.k);
    if (id === undefined) continue;
    const scopedId = `${scope}${id}`;
    const snippet = context.snippets[`${VARIABLE_PREFIX}${scopedId}`];
    if (typeof snippet === 'function') {
      return { snippet: snippet as VariableSnippet, scopedId };
    }
  }
  return undefined;
}

/** Reads a variable id, ignoring keys such as "toString" that are inherited. */
function getOwn(
  ids: Record<string, number> | undefined,
  key: string
): number | undefined {
  return ids && Object.hasOwn(ids, key) ? ids[key] : undefined;
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
