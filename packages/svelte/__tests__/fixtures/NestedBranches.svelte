<script lang="ts">
  import { T, Branch, Plural } from 'gt-svelte';

  let { gender = 'female', count = 2 }: { gender?: string; count?: number } =
    $props();
</script>

<T>
  <Branch branch={gender}>
    {#snippet male()}He has <Plural n={count} one="one cat" other="cats" />{/snippet}
    {#snippet female()}She has <Plural n={count}>{#snippet one()}one cat{/snippet}{#snippet other()}cats{/snippet}</Plural>{/snippet}
  </Branch>
</T>
