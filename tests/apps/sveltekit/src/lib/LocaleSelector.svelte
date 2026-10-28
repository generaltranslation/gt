<script lang="ts">
  import { useLocale, useSetLocale } from 'gt-svelte';
  import { LOCALE_COOKIE } from './gt';

  const locale = useLocale();
  const setLocale = useSetLocale();

  async function change(event: Event) {
    const next = (event.currentTarget as HTMLSelectElement).value;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000`;
    await setLocale(next);
  }
</script>

<select
  aria-label="General Translation locale selector"
  value={locale.current}
  onchange={change}
>
  <option value="en">English</option>
  <option value="fr">Français</option>
</select>
