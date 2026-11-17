<!--
  @component
  Formats a date for the active locale, in the medium date style unless
  `options` sets a style or a date or time field. Pass it as `value` or as
  the only child, `<DateTime>{date}</DateTime>`. Inside `<T>`, it is a
  variable.

  ```svelte
  <T>Updated <DateTime value={updatedAt} /></T>
  ```
-->

<svelte:options preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { withDefaultDateStyle } from 'generaltranslation/internal';
  import { getI18nConfig } from 'gt-i18n/internal';
  import { getFormatLocales } from '../runtime/format';
  import { useContentLocale } from '../runtime/source';

  let {
    value,
    options,
  }: {
    value?: Date | number | null | undefined;
    /**
     * The value as a single `{expression}` child, as in gt-react. The
     * gt-svelte preprocessor passes it as `value`.
     */
    children?: Snippet;
    options?: Intl.DateTimeFormatOptions;
    /** Variable key used in translations. Must be a static string. */
    name?: string;
  } = $props();

  const contentLocale = useContentLocale();
  const formatted = $derived(
    value == null
      ? null
      : getI18nConfig().formatDateTime(value, {
          locales: getFormatLocales(contentLocale.current),
          ...withDefaultDateStyle(options),
        })
  );
</script>

{formatted ?? ''}
