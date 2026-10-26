<script lang="ts">
  import { useLocale, useLocaleDirection, useSetLocale } from 'gt-svelte';

  const locale = useLocale();
  const dir = useLocaleDirection();
  const hebrew = useLocaleDirection('he');
  const setLocale = useSetLocale();
</script>

{#each ['en', 'fr', 'ar', 'he', 'fa'] as l}
  <button data-locale={l} onclick={() => setLocale(l)}>{l}</button>
{/each}
<p class="active" lang={locale.current} dir={dir.current}>{dir.current}</p>
<p class="fixed" dir={hebrew.current}>{hebrew.current}</p>
