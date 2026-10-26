<!--
  @component
  Formats a relative time ("3 days ago") for the active locale. Pass a
  `value` date, or a numeric `value` with a `unit`. Inside `<T>`, it is a
  variable.

  ```svelte
  <T>Posted <RelativeTime value={postedAt} /></T>
  ```
-->
<script lang="ts">
  import { getFormatLocales, getFormatter } from '../runtime/format';
  import { getGTState } from '../runtime/state.svelte';

  let {
    value,
    unit,
    baseDate,
    options = {},
    locales,
  }: {
    value: Date | number | null | undefined;
    /** Unit for a numeric `value`. */
    unit?: Intl.RelativeTimeFormatUnit;
    /** Date to measure from. Defaults to now. */
    baseDate?: Date;
    options?: Intl.RelativeTimeFormatOptions;
    /** Locales to try before the active locale. */
    locales?: string[];
    /** Variable key used in translations. Must be a static string. */
    name?: string;
  } = $props();

  const state = getGTState();
  const formatted = $derived.by(() => {
    if (value == null) return null;
    const formatOptions = {
      locales: getFormatLocales(state, locales),
      numeric: options.numeric,
      style: options.style,
      localeMatcher: options.localeMatcher,
    };
    if (typeof value === 'number') {
      return unit
        ? getFormatter().formatRelativeTime(value, unit, formatOptions)
        : null;
    }
    return getFormatter().formatRelativeTimeFromDate(value, {
      ...formatOptions,
      baseDate: baseDate ?? new Date(),
    });
  });
</script>

{formatted ?? ''}
