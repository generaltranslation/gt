<script lang="ts">
  import { T, Select } from 'gt-svelte';
  let { status }: { status: string } = $props();
</script>

<T><Select value={status} away="Away">{#snippet online()}<i>Online</i>{/snippet}Unknown</Select></T>
