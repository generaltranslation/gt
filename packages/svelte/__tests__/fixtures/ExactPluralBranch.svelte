<script lang="ts">
  import { T, Plural } from 'gt-svelte';

  let { n = 0 }: { n?: number } = $props();
</script>

<p>
  <T
    ><Plural {n}
      >{#snippet _0()}<i>None</i>{/snippet}<b>Items</b></Plural
    ></T
  >
</p>
