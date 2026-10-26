<script lang="ts">
  import { useGT, msg, useMessages } from 'gt-svelte';
  const gt = useGT();
  const m = useMessages();
  const items = msg(['First item', 'Second item'], { $context: 'list' });
</script>

<p class="concat">{gt('Hello ' + 'world')}</p>
<p class="max">{gt('Short', { $maxChars: -12 })}</p>
{#each items as item}<p class="item">{m(item)}</p>{/each}
