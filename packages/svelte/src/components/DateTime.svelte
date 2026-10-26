<!--
  @component
  Formats a date for the active locale. Inside `<T>`, it is a variable.

  ```svelte
  <T>Updated <DateTime value={updatedAt} /></T>
  ```
-->
<script lang="ts">
  import { getFormatLocales, getFormatter } from '../runtime/format';
  import { getGTState } from '../runtime/state.svelte';

  let {
    value,
    options = {},
    locales,
  }: {
    value: Date | null | undefined;
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
          .replace(/[‏‫‮]/g, '')
  );
</script>

{formatted ?? ''}
