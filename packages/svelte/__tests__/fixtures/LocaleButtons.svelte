<script lang="ts">
  import { useLocale, useSetLocale } from 'gt-svelte';
  import Greeting from './Greeting.svelte';
  const setLocale = useSetLocale();
  const locale = useLocale();
</script>

{#each ['en', 'fr', 'de'] as l}
  <button data-locale={l} onclick={() => setLocale(l)}>{l}</button>
{/each}
<span class="locale">{locale.current}</span>
<p class="greeting"><Greeting name="Ada" /></p>
