<script lang="ts">
  import { T, Num, Plural, useGT } from 'gt-svelte';

  let { n = 0 }: { n?: number } = $props();
  const t = useGT();
</script>

<p class="plural">
  <T><Plural {n} _2="a pair" one="one item">many items</Plural></T>
</p>
<p class="num"><T>Total: <Num value={1234.5} /></T></p>
<p class="str">{t('Total: {total, number}', { total: 1234.5 })}</p>
