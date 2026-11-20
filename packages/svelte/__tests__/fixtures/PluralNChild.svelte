<script lang="ts">
  import { T, Plural } from 'gt-svelte';
  import CountLabel from './CountLabel.svelte';

  let { count }: { count: number } = $props();
</script>

<p><T><Plural n={count} one="One file"><CountLabel /> files</Plural></T></p>
