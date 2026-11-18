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
    // `other` is not a branch: the fallback is the children.
    other: _other,
    ...branches
  }: {
    branch?: string | number | boolean | null;
    children?: Snippet;
    [branch: string]: unknown;
  } = $props();

  // A branch passed as undefined counts as absent, as in gt-react.
  const selected = $derived(
    branch != null &&
      Object.hasOwn(branches, String(branch)) &&
      branches[String(branch)] !== undefined
      ? branches[String(branch)]
      : children
  );
</script>

{#if typeof selected === 'function'}
    {@render (selected as Snippet)()}
{:else if typeof selected === 'string'}
    {selected}
{/if}
