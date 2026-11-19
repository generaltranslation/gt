<!--
  @component
  Marks dynamic content inside `<T>`. Its children render unchanged wherever
  the translation places them.

  ```svelte
  <T>Hello, <Var>{name}</Var>!</T>
  ```
-->

<svelte:options preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from 'svelte';

  // the `value` prop is intentionally not included, its a legacy part of the GT API
  let {
    children,
  }: {
    children?: Snippet;
    /** Name shown to translators. Must be a static string. */
    name?: string;
  } = $props();
</script>

{#if children}
    {@render children()}
{/if}
