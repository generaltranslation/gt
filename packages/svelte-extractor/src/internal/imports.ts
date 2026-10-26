import type { SvelteNode, SvelteRoot } from './types.js';

export const GT_SVELTE_PACKAGE = 'gt-svelte';

/** gt-svelte component exports the extractor understands. */
export type GTComponentKind =
  | 'T'
  | 'Var'
  | 'Num'
  | 'Currency'
  | 'DateTime'
  | 'RelativeTime'
  | 'Branch'
  | 'Plural';

/** gt-svelte function exports the string extractor understands. */
export type GTFunctionKind = 'useGT' | 'msg';

const COMPONENT_EXPORTS = new Set<string>([
  'T',
  'Var',
  'Num',
  'Currency',
  'DateTime',
  'RelativeTime',
  'Branch',
  'Plural',
]);

const FUNCTION_EXPORTS = new Set<string>(['useGT', 'msg']);

/** Local names bound to gt-svelte exports in a component's scripts. */
export type GTBindings = {
  /** Local component tag name -> gt-svelte export. */
  components: Map<string, GTComponentKind>;
  /** Local function name -> gt-svelte export. */
  functions: Map<string, GTFunctionKind>;
  /** Local names of `import * as ns from 'gt-svelte'`. */
  namespaces: Set<string>;
};

/**
 * Collects gt-svelte bindings from the instance and module scripts, including
 * aliased (`import { T as Translate }`) and namespace imports.
 */
export function collectGTBindings(root: SvelteRoot): GTBindings {
  const bindings: GTBindings = {
    components: new Map(),
    functions: new Map(),
    namespaces: new Set(),
  };
  for (const script of [root.module, root.instance]) {
    for (const statement of script?.content.body ?? []) {
      if (statement.type !== 'ImportDeclaration') continue;
      const source = statement.source as { value?: unknown };
      if (source.value !== GT_SVELTE_PACKAGE) continue;
      if (statement.importKind === 'type') continue;
      for (const specifier of statement.specifiers as SvelteNode[]) {
        const local = (specifier.local as { name: string }).name;
        if (specifier.type === 'ImportNamespaceSpecifier') {
          bindings.namespaces.add(local);
          continue;
        }
        if (specifier.type !== 'ImportSpecifier') continue;
        if (specifier.importKind === 'type') continue;
        const imported = getImportedName(specifier);
        if (COMPONENT_EXPORTS.has(imported)) {
          bindings.components.set(local, imported as GTComponentKind);
        } else if (FUNCTION_EXPORTS.has(imported)) {
          bindings.functions.set(local, imported as GTFunctionKind);
        }
      }
    }
  }
  return bindings;
}

/** Resolves a template component name such as `T` or `GT.T`. */
export function resolveComponent(
  bindings: GTBindings,
  name: string
): GTComponentKind | undefined {
  const direct = bindings.components.get(name);
  if (direct) return direct;
  const dot = name.indexOf('.');
  if (dot === -1) return undefined;
  const namespace = name.slice(0, dot);
  const member = name.slice(dot + 1);
  if (bindings.namespaces.has(namespace) && COMPONENT_EXPORTS.has(member)) {
    return member as GTComponentKind;
  }
  return undefined;
}

export function hasGTBindings(bindings: GTBindings): boolean {
  return (
    bindings.components.size > 0 ||
    bindings.functions.size > 0 ||
    bindings.namespaces.size > 0
  );
}

function getImportedName(specifier: SvelteNode): string {
  const imported = specifier.imported as { name?: string; value?: string };
  return imported.name ?? imported.value ?? '';
}
