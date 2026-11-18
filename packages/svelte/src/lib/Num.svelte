<script lang="ts">
  import { formatNum } from 'generaltranslation';
  import { getGT } from './runtime/context.js';

  const {
    value,
    locales,
    options = {},
  }: {
    value: number;
    locales?: string[];
    options?: Intl.NumberFormatOptions;
  } = $props();
  const gt = getGT();
</script>

{formatNum(value, { locales: gt.formatLocales(locales), ...options })}
