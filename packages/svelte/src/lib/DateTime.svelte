<script lang="ts">
  import { formatDateTime } from 'generaltranslation';
  import { getGT } from './runtime/context.js';

  const {
    value,
    locales,
    options = {},
  }: {
    value: Date | number | string;
    locales?: string[];
    options?: Intl.DateTimeFormatOptions;
  } = $props();
  const gt = getGT();
</script>

{formatDateTime(value instanceof Date ? value : new Date(value), {
  locales: gt.formatLocales(locales),
  ...options,
})}
