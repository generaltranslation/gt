<script lang="ts">
  import { T, Plural } from 'gt-svelte';

  let { n = 1, m = 1 }: { n?: number; m?: number } = $props();
</script>

<p>
  <T
    ><Plural {n}
      >{#snippet one()}One <Plural n={m} one="a">b</Plural>{/snippet}Many <Plural
        n={m}>{#snippet one()}<b>x</b>{/snippet}<i>y</i></Plural
      ></Plural
    ></T
  >
</p>
