<!--
  @component
  Renders the branch for `n` as ICU does: an exact number such as `_0`, then
  the active locale's plural category, then `other`. Branches are string props
  or snippets.

  ```svelte
  <Plural n={count} _0="No items" one="One item">
    {#snippet other()}<Num value={count} /> items{/snippet}
  </Plural>
  ```
-->

<svelte:options preserveWhitespace={false} />

<script lang="ts">
  import {
    getPluralBranchKey,
    getPluralForm,
  } from 'generaltranslation/internal';
  import type { PluralType } from 'generaltranslation';
  import type { Snippet } from 'svelte';
  import { useContentLocale } from '../runtime/source';

  let {
    n,
    ...branches
  }: {
    n: number | bigint;
    other: string | Snippet;
  } & Partial<
    Record<Exclude<PluralType, 'other'> | `_${number}`, string | Snippet>
  > = $props();

  const contentLocale = useContentLocale();
  const selected = $derived.by(() => {
    // Untyped callers can still pass other props, which match no key.
    const names = Object.keys(branches);
    const keys = names.map(getPluralBranchKey);
    const key =
      typeof n === 'number' || typeof n === 'bigint'
        ? getPluralForm(n, keys, [contentLocale.current])
        : 'other';
    return (branches as Record<string, unknown>)[names[keys.indexOf(key)]];
  });
</script>

{#if typeof selected === 'function'}
    {@render (selected as Snippet)()}
{:else if typeof selected === 'string'}
    {selected}
{/if}
