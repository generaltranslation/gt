<script lang="ts">
  import { createGT, gt, setGT, type TranslationCatalog } from 'gt-svelte';
  import { untrack } from 'svelte';
  import NestedProvider from './NestedProvider.svelte';

  const {
    translations,
    nestedTranslations,
  }: {
    translations: TranslationCatalog;
    nestedTranslations: TranslationCatalog;
  } = $props();

  untrack(() =>
    setGT(
      createGT({ locales: ['fr'], locale: 'fr', translations: { fr: translations } })
    )
  );
</script>

<h1>{gt('Hello')}</h1>
<NestedProvider translations={nestedTranslations} />
