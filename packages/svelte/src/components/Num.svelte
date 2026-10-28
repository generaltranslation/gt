<!--
  @component
  Formats a number for the active locale. Pass it as `value` or as the
  only child, `<Num>{count}</Num>`. Inside `<T>`, it is a variable.

  ```svelte
  <T>You have <Num value={count} /> messages</T>
  ```
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { getFormatLocales, getFormatter } from '../runtime/format';
  import { useContentLocale } from '../runtime/source';

  let {
    value,
    options = {},
    locales,
  }: {
    value?: number | string | null | undefined;
    /**
     * The value as a single `{expression}` child, as in gt-react. The
     * gt-svelte preprocessor passes it as `value`.
     */
    children?: Snippet;
    options?: Intl.NumberFormatOptions;
    /** Locales to try before the active locale. */
    locales?: string[];
    /** Variable key used in translations. Must be a static string. */
    name?: string;
  } = $props();

  const contentLocale = useContentLocale();
  const formatted = $derived(
    value == null
      ? null
      : getFormatter().formatNum(
          typeof value === 'string' ? parseFloat(value) : value,
          { locales: getFormatLocales(contentLocale.current, locales), ...options }
        )
  );
</script>

{formatted ?? ''}
