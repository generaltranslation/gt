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

  let {
    children,
    value,
  }: {
    children?: Snippet;
    /** Rendered when there are no children. */
    value?: unknown;
    /** Variable key used in translations. Must be a static string. */
    name?: string;
  } = $props();
</script>

{#if children}{@render children()}{:else if value != null}{String(value)}{/if}
