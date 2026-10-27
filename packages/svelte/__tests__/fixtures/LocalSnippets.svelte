<script lang="ts">
  import { T, Var } from 'gt-svelte';
  import Widget from './Widget.svelte';
</script>

<p class="component">
  <T>Tip: <b>{#snippet label()}Hint{/snippet}<Widget content={label} /></b></T>
</p>
<p class="variable">
  <T
    >Hello <b
      >{#snippet greet()}Ada{/snippet}<Var>{@render greet()}</Var></b
    ></T
  >
</p>
