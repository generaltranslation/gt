<script lang="ts">
  import { T, Var } from 'gt-svelte';
  let { name = 'Ada' }: { name?: string } = $props();
</script>

<T>
  Hello <b>dear</b> <Var>{name}</Var>!
</T>
