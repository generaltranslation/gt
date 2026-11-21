<script lang="ts">
  import { T, Select } from 'gt-svelte';
  let { status }: { status: string } = $props();
</script>

<T><Select value={status}>{#snippet on()}<i>On</i> <s>on</s>{/snippet}{#snippet off()}<b>Off</b> <u>off</u>{/snippet}</Select></T>
