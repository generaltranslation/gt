<script lang="ts">
  import { T, Num, Plural } from 'gt-svelte';

  let { n = 0 }: { n?: number } = $props();
</script>

<p class="plural">
  <T><Plural {n} _2="a pair" one="one item" other="many items" /></T>
</p>
<p class="num"><T>Total: <Num value={1234.5} /></T></p>
<p class="ordinal">
  <T><Plural {n} ordinal one="first" two="second" other="later" /></T>
</p>
