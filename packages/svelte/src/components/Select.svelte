<!--
  @component
  Renders the branch named by `value`, or its children when no branch
  matches. Branches are string props or snippets.

  ```svelte
  <Select value={status} inactive="Inactive">
    {#snippet active()}<b>Active</b>{/snippet}
    Unknown
  </Select>
  ```
-->

<svelte:options preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    value,
    children,
    // `other` is not a branch: the fallback is the children.
    other: _other,
    ...branches
  }: {
    value?: string | number | boolean | null;
    children?: Snippet;
    [branch: string]: unknown;
  } = $props();

  // A branch passed as undefined counts as absent, as in gt-react.
  const selected = $derived(
    value != null &&
      Object.hasOwn(branches, String(value)) &&
      branches[String(value)] !== undefined
      ? branches[String(value)]
      : children
  );
</script>

{#if typeof selected === 'function'}
    {@render (selected as Snippet)()}
{:else if typeof selected === 'string'}
    {selected}
{/if}
