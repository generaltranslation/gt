<script lang="ts">
  import type { Snippet } from 'svelte';

  let { content }: { content: Snippet } = $props();
</script>

<span class="widget">{@render content()}</span>
