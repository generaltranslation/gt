<script lang="ts">
  import { createGT, setGT } from 'gt-svelte';
  import { untrack } from 'svelte';
  import { defaultLocale, loadTranslations, locales } from '../i18n';
  import type { LayoutProps } from './$types';

  const { data, children }: LayoutProps = $props();

  // The runtime owns the locale after the first render, so only the initial
  // server data seeds it.
  untrack(() =>
    setGT(
      createGT({
        defaultLocale,
        locales,
        locale: data.locale,
        translations: { [data.locale]: data.translations },
        loadTranslations,
      })
    )
  );
</script>

{@render children()}
