<script lang="ts">
  import {
    useDefaultLocale,
    useLocaleProperties,
    useLocales,
    useSetLocale,
  } from 'gt-svelte';

  const defaultLocale = useDefaultLocale();
  const locales = useLocales();
  const properties = useLocaleProperties();
  const french = useLocaleProperties('fr');
  const setLocale = useSetLocale();
</script>

{#each locales as l}
  <button data-locale={l} onclick={() => setLocale(l)}>{l}</button>
{/each}
<p class="default">{defaultLocale}</p>
<p class="locales">{locales.join(',')}</p>
<p class="active">{properties.current.code}|{properties.current.nativeName}</p>
<p class="fixed">{french.current.code}|{french.current.nativeName}</p>
