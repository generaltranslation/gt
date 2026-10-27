<!--
  @component
  Marks dynamic content inside `<T>`. Its children render unchanged wherever
  the translation places them.

  ```svelte
  <T>Hello, <Var>{name}</Var>!</T>
  ```
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  // the `value` prop is intentionally not included, its a legacy part of the GT API
  let {
    children,
  }: {
    children?: Snippet;
    /** Variable key used in translations. Must be a static string. */
    name?: string;
  } = $props();
</script>

{#if children}
    {@render children()}
{/if}
