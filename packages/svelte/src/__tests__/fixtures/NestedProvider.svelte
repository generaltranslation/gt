<script lang="ts">
  import { createGT, gt, setGT, type TranslationCatalog } from 'gt-svelte';
  import { untrack } from 'svelte';

  const { translations }: { translations: TranslationCatalog } = $props();

  untrack(() =>
    setGT(
      createGT({ locales: ['fr'], locale: 'fr', translations: { fr: translations } })
    )
  );
</script>

<p>{gt('Hello')}</p>
