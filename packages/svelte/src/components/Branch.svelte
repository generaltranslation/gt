<!--
  @component
  Renders the branch named by `branch`, or the `other` branch when no branch
  matches. Branches are string props or snippets.

  ```svelte
  <Branch branch={status} inactive="Inactive" other="Unknown">
    {#snippet active()}<b>Active</b>{/snippet}
  </Branch>
  ```
-->

<svelte:options preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    branch,
    ...branches
  }: {
    branch?: string | number | boolean | null;
    [branch: string]: unknown;
  } = $props();

  // A branch passed as undefined counts as absent, as in gt-react.
  const selected = $derived(
    branch != null &&
      Object.hasOwn(branches, String(branch)) &&
      branches[String(branch)] !== undefined
      ? branches[String(branch)]
      : branches.other
  );
</script>

{#if typeof selected === 'function'}
    {@render (selected as Snippet)()}
{:else if typeof selected === 'string'}
    {selected}
{/if}
