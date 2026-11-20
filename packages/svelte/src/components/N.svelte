<!--
  @component
  The count of the `<Plural>` it is in, formatted as a number, as `#` is in
  ICU. A translation can show it in any branch of that plural.

  ```svelte
  <Plural n={count} one="One file"><N /> files</Plural>
  ```
-->

<svelte:options preserveWhitespace={false} />

<script lang="ts">
  import Num from './Num.svelte';
  import { usePluralCount } from '../runtime/count';

  const getCount = usePluralCount();
  const count = $derived(getCount());
</script>

<Num value={count ?? null} />
