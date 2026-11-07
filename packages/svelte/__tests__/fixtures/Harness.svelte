<script lang="ts">
  import type { Component } from 'svelte';
  import { GTProvider } from 'gt-svelte';
  import type { Content } from '@generaltranslation/format';

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
    translations?: Record<string, Content>;
  } = $props();
</script>

<GTProvider {locale} {translations}>
  <Child {...props} />
</GTProvider>
