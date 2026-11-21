<script lang="ts">
  import { Select } from 'gt-svelte';
  let { status }: { status: string } = $props();
</script>

<Select value={status} away="Away">{#snippet online()}<i>Online</i>{/snippet}Unknown</Select>
