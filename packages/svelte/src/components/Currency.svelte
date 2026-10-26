<!--
  @component
  Formats an amount of money for the active locale. Pass it as `value` or
  as the only child, `<Currency>{total}</Currency>`. Inside `<T>`, it is a
  variable.

  ```svelte
  <T>Total: <Currency value={total} currency="EUR" /></T>
  ```
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { getFormatLocales, getFormatter } from '../runtime/format';
  import { getGTState } from '../runtime/state.svelte';

  let {
    value,
    currency = 'USD',
    options = {},
    locales,
  }: {
    value?: number | string | null | undefined;
    /**
     * The value as a single `{expression}` child, as in gt-react. The
     * gt-svelte preprocessor passes it as `value`.
     */
    children?: Snippet;
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
