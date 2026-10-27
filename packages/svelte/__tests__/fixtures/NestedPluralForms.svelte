<script lang="ts">
  import { T, Plural } from 'gt-svelte';

  let { n = 1, m = 1 }: { n?: number; m?: number } = $props();
</script>

<p>
  <T
    ><Plural {n}
      >{#snippet one()}One <Plural n={m} one="a" other="b" />{/snippet}{#snippet other()}Many <Plural
          n={m}
          >{#snippet one()}<b>x</b>{/snippet}{#snippet other()}<i>y</i
          >{/snippet}</Plural
        >{/snippet}</Plural
    ></T
  >
</p>
