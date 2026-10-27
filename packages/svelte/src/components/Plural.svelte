<!--
  @component
  Renders the plural form of `n` for the active locale, or its children when
  no form matches. Forms are string props or snippets.

  ```svelte
  <Plural n={count} one="One item">
    {#snippet other()}<Num value={count} /> items{/snippet}
  </Plural>
  ```
-->
<script lang="ts">
  import { getPluralForm, isAcceptedPluralForm } from 'generaltranslation/internal';
  import { getI18nConfig } from 'gt-i18n/internal';
  import type { Snippet } from 'svelte';
  import { getGTState } from '../runtime/state.svelte';

  let {
    n,
    children,
    ...forms
  }: {
    n?: number | null;
    children?: Snippet;
    [form: string]: unknown;
  } = $props();

  const state = getGTState();
  const selected = $derived.by(() => {
    if (typeof n !== 'number') return undefined;
    const available = Object.keys(forms).filter(isAcceptedPluralForm);
    const form = getPluralForm(n, available, [
      state.locale,
      getI18nConfig().getDefaultLocale(),
    ]);
    return form ? forms[form] : undefined;
  });
</script>

{#if typeof selected === 'function'}
    {@render (selected as Snippet)()}
{:else if typeof selected === 'string'}
    {selected}
{:else}
    {@render children?.()}
{/if}
