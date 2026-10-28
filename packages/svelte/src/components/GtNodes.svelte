<!--
  @component
  Renders translated JSX children by calling the snippets the preprocessor
  generated from the source `<T>` children. Internal to gt-svelte.
-->

<svelte:options preserveWhitespace={false} />

<script lang="ts">
  import type { JsxChildren } from '@generaltranslation/format';
  import GtNodes from './GtNodes.svelte';
  import {
    selectBranch,
    toRenderItems,
    type RenderContext,
  } from '../runtime/nodes';

  let {
    nodes,
    scopes,
    parent,
    context,
  }: {
    nodes: JsxChildren | undefined;
    scopes: string[];
    /** Scoped id of the source element these nodes are children of. */
    parent: string;
    context: RenderContext;
  } = $props();

  const items = $derived(toRenderItems(nodes, scopes, parent, context));
</script>

{#each items as item (item.key)}
  {#if item.kind === 'text'}
    {item.text}
  {:else if item.kind === 'variable'}
    {@render item.snippet()}
  {:else if item.kind === 'element'}
    {#snippet kids()}
      <GtNodes nodes={item.node.c} {scopes} parent={item.scopedId} {context} />
    {/snippet}
    {@render item.snippet(kids, item.node.d)}
  {:else}
    {#snippet pick(value: unknown)}
      {@const branch = selectBranch(item, value, context)}
      <GtNodes
        nodes={branch.nodes}
        scopes={branch.scopes}
        parent={item.scopedId}
        {context}
      />
    {/snippet}
    {@render item.snippet(pick)}
  {/if}
{/each}
