<script lang="ts">
  import type { Component } from 'svelte';
  import { GTProvider } from 'gt-svelte';
  import type { Translation } from 'gt-i18n/types';

  let {
    component: Child,
    props = {},
    locale,
    translations,
  }: {
    // oxlint-disable-next-line typescript/no-explicit-any -- any fixture component
    component: Component<any>;
    props?: Record<string, unknown>;
    locale?: string;
    translations?: Record<string, Translation>;
  } = $props();
</script>

<GTProvider {locale} {translations}>
  <Child {...props} />
</GTProvider>
