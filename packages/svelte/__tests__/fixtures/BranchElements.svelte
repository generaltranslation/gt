<script lang="ts">
  import { T, Branch } from 'gt-svelte';
  let { status }: { status: string } = $props();
</script>

<T><Branch branch={status}>{#snippet on()}<i>On</i> <s>on</s>{/snippet}{#snippet off()}<b>Off</b> <u>off</u>{/snippet}</Branch></T>
