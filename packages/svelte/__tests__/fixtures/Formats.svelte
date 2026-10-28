<script lang="ts">
  import { Num, Currency } from 'gt-svelte';
</script>

<span class="num"><Num value={1234.5} /></span>
<span class="currency"><Currency value={3} currency="EUR" /></span>
