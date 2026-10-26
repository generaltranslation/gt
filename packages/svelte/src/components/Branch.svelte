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

  // Only passed props are branches: branch values may be user input such as
  // "toString", which must not resolve to Object.prototype members. Rest
  // props are a proxy whose `in` checks see the prototype, so use its keys.
  const selected = $derived.by(() => {
    if (branch == null || branch === '') return undefined;
    const key = String(branch);
    return Object.keys(branches).includes(key) ? branches[key] : undefined;
  });
</script>

{#if typeof selected === 'function'}{@render (selected as Snippet)()}{:else if typeof selected === 'string'}{selected}{:else}{@render children?.()}{/if}
