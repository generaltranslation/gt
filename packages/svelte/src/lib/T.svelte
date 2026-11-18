<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { JsxChildren } from 'generaltranslation/types';
  import { getGT } from './runtime/context.js';
  import { notCompiledDiagnostic } from './runtime/diagnostics.js';
  import {
    childList,
    isElementNode,
    isVariableNode,
    variableIds,
  } from './runtime/richContent.js';
  import { snippetName } from './shared/protocol.js';

  type ShellSnippet = Snippet<
    [Snippet<[JsxChildren | undefined]>, JsxChildren | undefined]
  >;

  // These names must match hashProp and sourceProp in shared/protocol.ts.
  const {
    __gt_hash: hash,
    __gt_source: source,
    ...snippets
  }: {
    __gt_hash?: string;
    __gt_source?: JsxChildren;
    [snippet: string]: unknown;
  } = $props();
  const gt = getGT();
  const ids = $derived(variableIds(source ?? null));
  const content = $derived.by(() => {
    if (hash === undefined) throw new Error(notCompiledDiagnostic('<T>'));
    return gt.jsx(hash) ?? source;
  });

  function shell(id: number | undefined): ShellSnippet | undefined {
    return id === undefined
      ? undefined
      : (snippets[snippetName(id)] as ShellSnippet | undefined);
  }
</script>

{#snippet nodes(children: JsxChildren | undefined)}{#each childList(children) as node}{#if typeof node === 'string'}{node}{:else if isVariableNode(node)}{@render shell(ids.get(node.k))?.(nodes, undefined)}{:else if isElementNode(node)}{@const render = shell(node.i)}{#if render}{@render render(nodes, node.c)}{:else}{@render nodes(node.c)}{/if}{/if}{/each}{/snippet}{@render nodes(content)}
