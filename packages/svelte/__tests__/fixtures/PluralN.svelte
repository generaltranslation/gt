<script lang="ts">
  import { T, Plural, N } from 'gt-svelte';

  let { count, wrap = 'inside' }: { count: number; wrap?: string } = $props();
</script>

{#if wrap === 'inside'}
  <p><T><Plural n={count} one="One file"><b><N /></b> files</Plural></T></p>
{:else if wrap === 'none'}
  <p><Plural n={count} one="One file"><b><N /></b> files</Plural></p>
{:else}
  <p><Plural n={count}><T><N /> files</T></Plural></p>
{/if}
