<script lang="ts">
  import { T, Select, Plural } from 'gt-svelte';

  let { gender = 'female', count = 2 }: { gender?: string; count?: number } =
    $props();
</script>

<T>
  <Select value={gender}>
    {#snippet male()}He has <Plural n={count} one="one cat">cats</Plural>{/snippet}
    {#snippet female()}She has <Plural n={count}>{#snippet one()}one cat{/snippet}cats</Plural>{/snippet}
  </Select>
</T>
