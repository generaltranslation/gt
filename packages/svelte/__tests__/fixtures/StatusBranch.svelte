<script lang="ts">
  import { T, Branch } from 'gt-svelte';
  let { status }: { status: string } = $props();
</script>

<T><Branch branch={status} away="Away">{#snippet online()}<i>Online</i>{/snippet}Unknown</Branch></T>
