<!--
  @component
  Formats a relative time ("3 days ago") for the active locale. Pass a
  `value` date, or a numeric `value` with a `unit`. The value can also be
  the only child, `<RelativeTime>{date}</RelativeTime>`. Inside `<T>`, it is
  a variable.

  ```svelte
  <T>Posted <RelativeTime value={postedAt} /></T>
  ```
-->

<svelte:options preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { getI18nConfig } from 'gt-i18n/internal';
  import { getFormatLocales } from '../runtime/format';
  import { useContentLocale } from '../runtime/source';

  type Props = {
    /**
     * The value as a single `{expression}` child, as in gt-react. The
     * gt-svelte preprocessor passes it as `value`.
     */
    children?: Snippet;
    /** Date to measure from. Defaults to now. */
    baseDate?: Date;
    options?: Intl.RelativeTimeFormatOptions;
    /** Name shown to translators. Must be a static string. */
    name?: string;
  } & (
    | {
        value?: Date | number | null | undefined;
        /** Unit for a numeric `value`. */
        unit: Intl.RelativeTimeFormatUnit;
      }
    | {
        value?: Date | null | undefined;
        unit?: Intl.RelativeTimeFormatUnit;
      }
  );

  let { value, unit, baseDate, options = {} }: Props = $props();

  const contentLocale = useContentLocale();
  const formatted = $derived.by(() => {
    if (value == null) return null;
    const formatOptions = {
      locales: getFormatLocales(contentLocale.current),
      numeric: options.numeric,
      style: options.style,
      localeMatcher: options.localeMatcher,
    };
    if (typeof value === 'number') {
      return unit
        ? getI18nConfig().formatRelativeTime(value, unit, formatOptions)
        : null;
    }
    return getI18nConfig().formatRelativeTimeFromDate(value, {
      ...formatOptions,
      baseDate: baseDate ?? new Date(),
    });
  });
</script>

{formatted ?? ''}
