<!--
  @component
  Formats a number for the active locale. Inside `<T>`, it is a variable.

  ```svelte
  <T>You have <Num value={count} /> messages</T>
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
    value: number | string | null | undefined;
    options?: Intl.NumberFormatOptions;
    /** Locales to try before the active locale. */
    locales?: string[];
    /** Variable key used in translations. Must be a static string. */
    name?: string;
  } = $props();

  const state = getGTState();
  const formatted = $derived(
    value == null
      ? null
      : getFormatter().formatNum(
          typeof value === 'string' ? parseFloat(value) : value,
          { locales: getFormatLocales(state, locales), ...options }
        )
  );
</script>

{formatted ?? ''}
