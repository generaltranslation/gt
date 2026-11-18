<script lang="ts">
  import { formatCurrency } from 'generaltranslation';
  import { getGT } from './runtime/context.js';

  const {
    value,
    currency,
    locales,
    options = {},
  }: {
    value: number;
    currency: string;
    locales?: string[];
    options?: Intl.NumberFormatOptions;
  } = $props();
  const gt = getGT();
</script>

{formatCurrency(value, currency, {
  locales: gt.formatLocales(locales),
  ...options,
})}
