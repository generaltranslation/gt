<!-- The README's component that keeps <html lang dir> in sync. -->
<script lang="ts">
  import { useLocale, useLocaleDirection } from 'gt-svelte';

  const locale = useLocale();
  const dir = useLocaleDirection();

  $effect(() => {
    document.documentElement.lang = locale.current;
    document.documentElement.dir = dir.current;
  });
</script>
