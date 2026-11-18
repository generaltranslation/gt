<script lang="ts">
  import { T, Var, Branch } from 'gt-svelte';

  let { status = 'constructor' }: { status?: string } = $props();
  const a = 'A';
  const b = 'B';
</script>

<p class="var">
  <T>Hello <Var name="__proto__">{a}</Var> and <Var name="b">{b}</Var></T>
</p>
<p class="branch">
  <T
    ><Branch branch={status}
      >{#snippet constructor()}Builder{/snippet}Other</Branch
    ></T
  >
</p>
