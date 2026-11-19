<script lang="ts">
  import { T, Plural, Num } from 'gt-svelte';

  let { count, size }: { count: number; size: number } = $props();
</script>

<p>
  <T
    ><Plural n={count}
      >{#snippet one()}<Num value={size} /> MB file{/snippet}<b
        ><Num value={count} /></b
      > files</Plural
    ></T
  >
</p>
