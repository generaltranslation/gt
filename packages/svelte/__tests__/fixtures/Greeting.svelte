<script lang="ts">
  import { T, Var } from 'gt-svelte';
  let { name }: { name: string } = $props();
</script>

<T context="greeting">
  Hello <b class="x" title="Bold">dear <Var>{name}</Var></b>!
</T>
