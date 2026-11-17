<script lang="ts">
  import { T, Branch } from 'gt-svelte';
  let { status }: { status: string } = $props();
</script>

<T><Branch branch={status} away="Away" other="Unknown">{#snippet online()}<i>Online</i>{/snippet}</Branch></T>
