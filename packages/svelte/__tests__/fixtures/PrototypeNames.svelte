<script lang="ts">
  import { T, Var, Select } from 'gt-svelte';

  let { status = 'constructor' }: { status?: string } = $props();
  const a = 'A';
  const b = 'B';
</script>

<p class="var">
  <T>Hello <Var name="__proto__">{a}</Var> and <Var name="b">{b}</Var></T>
</p>
<p class="branch">
  <T
    ><Select value={status}
      >{#snippet constructor()}Builder{/snippet}Other</Select
    ></T
  >
</p>
