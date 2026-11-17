<script lang="ts">
  import { Num, Currency, DateTime } from 'gt-svelte';
</script>

<span class="num"><Num value={1234.5} /></span>
<span class="currency"><Currency value={3} currency="EUR" /></span>
<span class="date"><DateTime value={0} options={{ timeZone: 'UTC' }} /></span>
