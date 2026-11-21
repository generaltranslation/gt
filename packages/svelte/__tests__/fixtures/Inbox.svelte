<script lang="ts">
  import { T, Plural, Num, Var, Select } from 'gt-svelte';
  let { count, status, name }: { count: number; status: string; name: string } =
    $props();
</script>

<p class="plural">
  <T>
    <Plural n={count}>
      {#snippet one()}<b>One</b> message{/snippet}
      <Num value={count} /> messages
    </Plural>
  </T>
</p>
<p class="branch">
  <T>
    <Select value={status} away="Away">
      {#snippet online()}<i>Online</i> as <Var>{name}</Var>{/snippet}
      Unknown
    </Select>
  </T>
</p>
