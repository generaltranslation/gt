<script lang="ts">
  import { T, Num, Var, Currency } from 'gt-svelte';
  let { count }: { count: number } = $props();
</script>

<p><T>You have <Num>{count}</Num> items and <Var>{count}</Var> more</T></p>
<p><T>You have <Num>{5}</Num> items</T></p>
<p><Currency currency="EUR">{count}</Currency></p>
