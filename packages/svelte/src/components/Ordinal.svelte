<!--
  @component
  `<Plural>` for ordinals such as 1st, 2nd and 3rd: renders the branch for `n`
  as ICU does, an exact number such as `_1`, then the active locale's ordinal
  category, then its children. Branches are string props or snippets.

  ```svelte
  <Ordinal n={place} one="first" two="second" few="third">
    later
  </Ordinal>
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
    selectPluralBranch(n, branches, children, contentLocale.current, 'ordinal')
  );
</script>

{#if typeof selected === 'function'}
    {@render (selected as Snippet)()}
{:else if typeof selected === 'string'}
    {selected}
{/if}
