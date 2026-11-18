<script lang="ts">
  import { Plural } from 'gt-svelte';
  let { n }: { n: number } = $props();
</script>

<Plural {n} one="one item" other="many items" />
