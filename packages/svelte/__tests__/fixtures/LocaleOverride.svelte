<script lang="ts">
  import { useGT } from 'gt-svelte';

  const t = useGT();
</script>

<p class="override">{t('Saved', { $locale: 'fr' })}</p>
