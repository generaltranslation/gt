<script lang="ts">
  import { useGT } from 'gt-svelte';
  const gt = useGT();
</script>

<p class="gt">
  {gt('Hello, {name}!', { name: 'Ada' }, (locale) =>
    locale === 'fr' ? 'Bonjour, {name} !' : undefined
  )}
</p>
