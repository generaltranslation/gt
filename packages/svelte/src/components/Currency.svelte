<!--
  @component
  Formats an amount of money for the active locale. Inside `<T>`, it is a
  variable.

  ```svelte
  <T>Total: <Currency value={total} currency="EUR" /></T>
  ```
-->
<script lang="ts">
  import { getFormatLocales, getFormatter } from '../runtime/format';
  import { getGTState } from '../runtime/state.svelte';

  let {
    value,
    currency = 'USD',
    options = {},
    locales,
  }: {
    value: number | string | null | undefined;
    /** ISO 4217 currency code. Defaults to `USD`. */
    currency?: string;
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
      : getFormatter().formatCurrency(
          typeof value === 'string' ? parseFloat(value) : value,
          currency,
          { locales: getFormatLocales(state, locales), ...options }
        )
  );
</script>

{formatted ?? ''}
