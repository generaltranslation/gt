<script lang="ts">
  import { T, Var } from 'gt-svelte';

  let { first = 'Ada', second = 'Grace' }: { first?: string; second?: string } =
    $props();
</script>

<T><b><Var name="who">{first}</Var></b> and <Var name="who">{second}</Var></T>
