<!--
  @component
  Renders the branch named by `branch`, or its children when no branch
  matches. Branches are string props or snippets.

  ```svelte
  <Branch branch={status} inactive="Inactive">
    {#snippet active()}<b>Active</b>{/snippet}
    Unknown
  </Branch>
  ```
-->

<svelte:options preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    branch,
    children,
    ...branches
  }: {
    branch?: string | number | boolean | null;
    children?: Snippet;
    [branch: string]: unknown;
  } = $props();

  const selected = $derived.by(() => {
    if (branch == null || branch === '') return undefined;
    const key = String(branch);
    return branches[key];
  });
</script>

{#if typeof selected === 'function'}
    {@render (selected as Snippet)()}
{:else if typeof selected === 'string'}
    {selected}
{:else}
    {@render children?.()}
{/if}
