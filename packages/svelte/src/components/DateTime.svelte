<!--
  @component
  Formats a date for the active locale. Pass it as `value` or as the only
  child, `<DateTime>{date}</DateTime>`. Inside `<T>`, it is a variable.

  ```svelte
  <T>Updated <DateTime value={updatedAt} /></T>
  ```
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { getFormatLocales, getFormatter } from '../runtime/format';
  import { getGTState } from '../runtime/state.svelte';

  let {
    value,
    options = {},
    locales,
  }: {
    value?: Date | null | undefined;
    /**
     * The value as a single `{expression}` child, as in gt-react. The
     * gt-svelte preprocessor passes it as `value`.
     */
    children?: Snippet;
    options?: Intl.DateTimeFormatOptions;
    /** Locales to try before the active locale. */
    locales?: string[];
    /** Variable key used in translations. Must be a static string. */
    name?: string;
  } = $props();

  const state = getGTState();
  const formatted = $derived(
    value == null
      ? null
      : getFormatter()
          .formatDateTime(value, {
            locales: getFormatLocales(state, locales),
            ...options,
          })
          .replace(/[\u200F\u202B\u202E]/g, '')
  );
</script>

{formatted ?? ''}
