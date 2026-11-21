import type {
  JsxChild,
  JsxChildren,
  JsxElement,
} from '@generaltranslation/format';
import { getPluralForm, isVariable } from 'generaltranslation/internal';
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
      const resolved = resolve(VARIABLE_PREFIX, node.i, scopes, context);
      if (resolved) {
        items.push({
          kind: 'variable',
          key: uniqueKey(`v${resolved.scopedId}`),
          snippet: resolved.snippet as VariableSnippet,
        });
      }
      return;
    }
    if (!isElement(node)) return;
    const resolved = resolve(ELEMENT_PREFIX, node.i, scopes, context);
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
      });
    }
  });
  return items;
}

/**
 * Picks the translated branch to render for a Select/Plural element, along
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
  const none = { nodes: undefined, scopes };
  if (!info) return none;

  const branches = Object.keys(targetBranches);
  const targetBranch =
    info.t === 'b'
      ? pickBranch(value, branches)
      : pickPluralForm(value, branches, context.locales, info.t === 'o');
  if (targetBranch === undefined) return none;
  const ownerScope = scopedId.slice(0, scopedId.length - String(node.i).length);
  return {
    nodes: targetBranches[targetBranch],
    scopes: getBranchScopes(
      ownerScope,
      node,
      info.b,
      getPairedSourceBranch(info.b, targetBranch),
      scopes
    ),
  };
}

/**
 * Checks that every element and variable in a translation resolves to a
 * generated snippet. Branch content is checked in the scopes of the source
 * branch selectBranch() pairs it with.
 */
export function validateTarget(
  nodes: JsxChildren | undefined,
  scopes: string[],
  context: RenderContext
): boolean {
  for (const node of toArray(nodes)) {
    if (typeof node === 'string') continue;
    if (isVariable(node)) {
      if (!resolve(VARIABLE_PREFIX, node.i, scopes, context)) return false;
      continue;
    }
    if (!isElement(node)) return false;
    const resolved = resolve(ELEMENT_PREFIX, node.i, scopes, context);
    if (!resolved) return false;
    const info = context.meta.b?.[resolved.scopedId];
    if (info) {
      const branches = getBranches(node);
      if (branches === null) return false;
      // A translation that could leave a value without a branch is not
      // rendered: it needs `other`, or every branch of the source.
      const names = Object.keys(branches ?? {});
      if (
        !names.includes('other') &&
        !info.b.every((name) => names.includes(name))
      ) {
        return false;
      }
      for (const [name, branch] of Object.entries(branches ?? {})) {
        const branchScopes = getBranchScopes(
          resolved.scope,
          node,
          info.b,
          getPairedSourceBranch(info.b, name),
          scopes
        );
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

/**
 * Returns a Select/Plural element's translated branches: `undefined` when
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
 * Returns the source branch a translated branch pairs with: the same-named
 * one, or `other` when the source has no branch of that name.
 */
function getPairedSourceBranch(
  sourceBranches: string[],
  name: string
): string | undefined {
  return [name, 'other'].find((branch) => sourceBranches.includes(branch));
}

/**
 * Returns the scopes a Select/Plural element's branch content resolves in:
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
  const branchScopes = ordered.map(
    (index) => `${ownerScope}b${node.i}_${index}$`
  );
  return [...branchScopes, ...scopes];
}

/** The branch ICU picks for `n`; anything but a number only fits `other`. */
function pickPluralForm(
  n: unknown,
  branches: string[],
  locales: string[],
  ordinal: boolean
): string | undefined {
  if (typeof n !== 'number' && typeof n !== 'bigint') {
    return pickBranch(undefined, branches);
  }
  const type = ordinal ? 'ordinal' : 'cardinal';
  return getPluralForm(n, branches, locales, type) || undefined;
}

/** The branch named by the value, then `other`. */
function pickBranch(value: unknown, branches: string[]): string | undefined {
  const key = value == null ? 'other' : String(value);
  if (branches.includes(key)) return key;
  return branches.includes('other') ? 'other' : undefined;
}

/** Finds the snippet of the source element or variable with this id. */
function resolve(
  prefix: string,
  id: number | undefined,
  scopes: string[],
  context: RenderContext
): { snippet: unknown; scope: string; scopedId: string } | undefined {
  if (typeof id !== 'number') return undefined;
  for (const scope of scopes) {
    const snippet = context.snippets[`${prefix}${scope}${id}`];
    if (typeof snippet === 'function') {
      return { snippet, scope, scopedId: `${scope}${id}` };
    }
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
