<script lang="ts">
  import { T, Var } from 'gt-svelte';
  let { a = 'A', b = 'B' }: { a?: string; b?: string } = $props();
</script>

<p><T><Var name="a">{a}</Var> and <Var name="a#1">{b}</Var></T></p>
<p><T><Var name="">{a}</Var> and <Var name="#1">{b}</Var></T></p>
<p><T><Var name="first"><em>{a}</em></Var> and <Var name="second"><strong>{b}</strong></Var></T></p>
