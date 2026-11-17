<script lang="ts">
  import { Branch } from 'gt-svelte';
  let { status }: { status: string } = $props();
</script>

<Branch branch={status} away="Away" other="Unknown">{#snippet online()}<i>Online</i>{/snippet}</Branch>
