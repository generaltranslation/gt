<script lang="ts">
  import { Branch } from 'gt-svelte';
  let { status }: { status: string } = $props();
</script>

<Branch branch={status} away="Away">{#snippet online()}<i>Online</i>{/snippet}Unknown</Branch>
