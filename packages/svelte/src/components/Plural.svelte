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
  import type { PluralType } from 'generaltranslation';
  import type { Snippet } from 'svelte';
  import { selectPluralBranch } from '../runtime/plural';
  import { useContentLocale } from '../runtime/source';

  let {
    n,
    children,
    ...branches
  }: {
    n: number | bigint;
    /** The fallback, as `other` is in `plural()`. */
    children: Snippet;
  } & Partial<
    Record<Exclude<PluralType, 'other'> | `_${number}`, string | Snippet>
  > = $props();

  const contentLocale = useContentLocale();
  const selected = $derived(
    selectPluralBranch(n, branches, children, contentLocale.current, 'cardinal')
  );
</script>

{#if typeof selected === 'function'}
    {@render (selected as Snippet)()}
{:else if typeof selected === 'string'}
    {selected}
{/if}
