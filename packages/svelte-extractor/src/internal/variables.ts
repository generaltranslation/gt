import type { GTBindings } from './imports.js';
import { resolveComponent } from './imports.js';
import {
  findAttribute,
  type TextEdit,
  type TranslationProblem,
} from './translation.js';
import type { SvelteElementNode, SvelteNode } from './types.js';

/** Variable components that format a value, which gt-react passes as children. */
const VALUE_VARIABLES = new Set([
  'Num',
  'Currency',
  'DateTime',
  'RelativeTime',
]);

/** How to rewrite the variable components of a Svelte component. */
export type VariablePlan = {
  /**
   * Edits that turn `<Num>{count}</Num>` into `<Num value={count}></Num>`:
   * a component cannot read a value out of its children snippet.
   */
  edits: TextEdit[];
  problems: TranslationProblem[];
};

/**
 * Plans the rewrite of every gt-svelte variable component in a fragment,
 * inside and outside `<T>`, and reports children that would be ignored.
 */
export function planVariables(
  source: string,
  fragment: unknown,
  bindings: GTBindings
): VariablePlan {
  const plan: VariablePlan = { edits: [], problems: [] };
  for (const node of findVariableComponents(fragment, bindings)) {
    planVariable(source, node, plan);
  }
  plan.edits.sort((a, b) => a.start - b.start);
  return plan;
}

function planVariable(
  source: string,
  node: SvelteElementNode,
  plan: VariablePlan
): void {
  const children = node.fragment.nodes.filter(
    (child) =>
      child.type !== 'Comment' &&
      !(child.type === 'Text' && !(child.data as string).trim())
  );
  if (children.length === 0) return;
  const valueAttribute = findAttribute(node, 'value');
  if (valueAttribute) {
    plan.problems.push({
      offset: valueAttribute.start,
      whatHappened: `<${node.name}> has both a "value" prop and children, so the children would be ignored`,
      fix: 'Remove the "value" prop or the children',
    });
    return;
  }
  const [child] = children;
  if (children.length > 1 || child.type !== 'ExpressionTag') {
    plan.problems.push({
      offset: child.start,
      whatHappened: `The children of <${node.name}> must be a single {expression}, which becomes its value`,
      fix: `Write <${node.name}>{value}</${node.name}> or <${node.name} value={value} />`,
    });
    return;
  }
  const nodes = node.fragment.nodes;
  // The fragment starts right after the `>` that closes the opening tag.
  const openingTagEnd = nodes[0].start - 1;
  plan.edits.push({
    start: openingTagEnd,
    end: nodes[nodes.length - 1].end,
    text: ` value={${source.slice(child.start + 1, child.end - 1)}}>`,
  });
}

/** Finds value variable components, including ones nested in other variables. */
function findVariableComponents(
  value: unknown,
  bindings: GTBindings,
  found: SvelteElementNode[] = []
): SvelteElementNode[] {
  if (!value || typeof value !== 'object') return found;
  if (Array.isArray(value)) {
    for (const item of value) findVariableComponents(item, bindings, found);
    return found;
  }
  const node = value as SvelteNode;
  if (node.type === 'Component') {
    const kind = resolveComponent(bindings, node.name as string);
    if (kind && VALUE_VARIABLES.has(kind)) {
      found.push(node as SvelteElementNode);
    }
  }
  for (const key in node) {
    if (key === 'metadata' || key === 'loc' || key === 'name_loc') continue;
    const child = node[key];
    if (child && typeof child === 'object') {
      findVariableComponents(child, bindings, found);
    }
  }
  return found;
}
