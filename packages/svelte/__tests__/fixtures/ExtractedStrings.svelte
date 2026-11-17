<script lang="ts">
  import { useGT, msg, useMessages } from 'gt-svelte';
  const t = useGT();
  const m = useMessages();
  const items = msg(['First item', 'Second item'], { $context: 'list' });
</script>

<p class="concat">{t('Hello ' + 'world')}</p>
<p class="max">{t('Short', { $maxChars: -12 })}</p>
<p class="string">{t('Literal {braces}', { $format: 'STRING' })}</p>
{#each items as item}<p class="item">{m(item)}</p>{/each}
