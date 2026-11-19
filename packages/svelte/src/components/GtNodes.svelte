<!--
  @component
  Renders translated JSX children by calling the snippets the preprocessor
  generated from the source `<T>` children. Internal to gt-svelte.
-->

<svelte:options preserveWhitespace={false} />

<script lang="ts">
  import type { JsxChildren } from '@generaltranslation/format';
  import GtNodes from './GtNodes.svelte';
  import N from './N.svelte';
  import {
    setPluralCount,
    toPluralCount,
    usePluralCount,
    type PluralCount,
  } from '../runtime/count';
  import {
    selectBranch,
    toRenderItems,
    type RenderContext,
  } from '../runtime/nodes';

  let {
    nodes,
    scopes,
    context,
    plural,
    count,
  }: {
    nodes: JsxChildren | undefined;
    scopes: string[];
    context: RenderContext;
    /** Whether these nodes are the branch of a plural, whose `n` is `count`. */
    plural?: boolean;
    count?: PluralCount;
  } = $props();

  // A translated branch is not rendered inside its `<Plural>`, so the `<N>`
  // in it, at any depth, is told the count here. Other nodes pass on the
  // count around them.
  const outerCount = usePluralCount();
  setPluralCount(() => (plural ? count : outerCount()));

  const items = $derived(toRenderItems(nodes, scopes, context));
</script>

{#each items as item (item.key)}
  {#if item.kind === 'text'}
    {item.text}
  {:else if item.kind === 'variable'}
    {@render item.snippet()}
  {:else if item.kind === 'count'}
    <N />
  {:else if item.kind === 'element'}
    {#snippet kids()}
      <GtNodes nodes={item.node.c} {scopes} {context} />
    {/snippet}
    {@render item.snippet(kids, item.node.d)}
  {:else}
    {#snippet pick(value: unknown)}
      {@const branch = selectBranch(item, value, context)}
      <GtNodes
        nodes={branch.nodes}
        scopes={branch.scopes}
        {context}
        plural={branch.plural}
        count={toPluralCount(value)}
      />
    {/snippet}
    {@render item.snippet(pick)}
  {/if}
{/each}
