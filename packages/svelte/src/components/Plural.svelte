<!--
  @component
  Renders the branch for `n` as ICU does: an exact number such as `_0`, then
  the active locale's plural category, then its children. Branches are string
  props or snippets.

  ```svelte
  <Plural n={count} _0="No items" one="One item">
    <Num value={count} /> items
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
    children,
    ...branches
  }: {
    n: number | bigint;
    /** The fallback, as `other` is in `plural()`. */
    children: Snippet;
    other?: never;
  } & Partial<
    Record<Exclude<PluralType, 'other'> | `_${number}`, string | Snippet>
  > = $props();

  const contentLocale = useContentLocale();
  const selected = $derived.by(() => {
    // Untyped callers can still pass other props, which match no key. A
    // branch passed as undefined counts as absent, as in gt-react.
    const all: Record<string, unknown> = branches;
    // `other` is not a prop: the children are ICU's `other`.
    const names = Object.keys(all).filter(
      (name) => name !== 'other' && all[name] !== undefined
    );
    const keys = names.map(getPluralBranchKey);
    const key =
      typeof n === 'number' || typeof n === 'bigint'
        ? getPluralForm(n, [...keys, 'other'], [contentLocale.current])
        : 'other';
    return key === 'other' ? children : all[names[keys.indexOf(key)]];
  });
</script>

{#if typeof selected === 'function'}
    {@render (selected as Snippet)()}
{:else if typeof selected === 'string'}
    {selected}
{/if}
