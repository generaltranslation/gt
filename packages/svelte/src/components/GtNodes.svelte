<!--
  @component
  Renders translated JSX children by calling the snippets the preprocessor
  generated from the source `<T>` children. Internal to gt-svelte.
-->

<svelte:options preserveWhitespace={false} />

<script lang="ts">
  import type { JsxChildren } from '@generaltranslation/format';
  import GtNodes from './GtNodes.svelte';
  import Num from './Num.svelte';
  import {
    selectBranch,
    toRenderItems,
    type RenderContext,
  } from '../runtime/nodes';

  let {
    nodes,
    scopes,
    context,
    count,
  }: {
    nodes: JsxChildren | undefined;
    scopes: string[];
    context: RenderContext;
    /** The `n` of the nearest `<Plural>`, which a count variable shows. */
    count?: unknown;
  } = $props();

  const items = $derived(toRenderItems(nodes, scopes, context));
</script>

{#each items as item (item.key)}
  {#if item.kind === 'text'}
    {item.text}
  {:else if item.kind === 'variable'}
    {@render item.snippet()}
  {:else if item.kind === 'count'}
    <Num
      value={typeof count === 'number' || typeof count === 'bigint'
        ? count
        : null}
    />
  {:else if item.kind === 'element'}
    {#snippet kids()}
      <GtNodes nodes={item.node.c} {scopes} {context} {count} />
    {/snippet}
    {@render item.snippet(kids, item.node.d)}
  {:else}
    {#snippet pick(value: unknown)}
      {@const branch = selectBranch(item, value, context)}
      <GtNodes
        nodes={branch.nodes}
        scopes={branch.scopes}
        {context}
        count={branch.plural ? value : count}
      />
    {/snippet}
    {@render item.snippet(pick)}
  {/if}
{/each}
