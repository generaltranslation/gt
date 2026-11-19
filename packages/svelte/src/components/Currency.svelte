<!--
  @component
  Formats an amount of money for the active locale. Pass it as `value` or
  as the only child, `<Currency>{total}</Currency>`. Inside `<T>`, it is a
  variable.

  ```svelte
  <T>Total: <Currency value={total} currency="EUR" /></T>
  ```
-->

<svelte:options preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { getI18nConfig } from 'gt-i18n/internal';
  import { getFormatLocales } from '../runtime/format';
  import { useContentLocale } from '../runtime/source';

  let {
    value,
    currency,
    options = {},
  }: {
    value?: number | bigint | null | undefined;
    /**
     * The value as a single `{expression}` child, as in gt-react. The
     * gt-svelte preprocessor passes it as `value`.
     */
    children?: Snippet;
    /** ISO 4217 currency code. */
    currency: string;
    options?: Intl.NumberFormatOptions;
    /** Name shown to translators. Must be a static string. */
    name?: string;
  } = $props();

  const contentLocale = useContentLocale();
  const formatted = $derived(
    value == null
      ? null
      : getI18nConfig().formatCurrency(value, currency, {
          locales: getFormatLocales(contentLocale.current),
          ...options,
          currency,
        })
  );
</script>

{formatted ?? ''}
