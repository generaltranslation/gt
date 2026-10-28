<script lang="ts">
  import { T, Plural, Num, Var, Branch } from 'gt-svelte';
  let { count, status, name }: { count: number; status: string; name: string } =
    $props();
</script>

<p class="plural">
  <T>
    <Plural n={count}>
      {#snippet one()}<b>One</b> message{/snippet}
      {#snippet other()}<Num value={count} /> messages{/snippet}
    </Plural>
  </T>
</p>
<p class="branch">
  <T>
    <Branch branch={status} away="Away">
      {#snippet online()}<i>Online</i> as <Var>{name}</Var>{/snippet}
      Unknown
    </Branch>
  </T>
</p>
