<!--
  @component
  Translates its children. The gt-svelte preprocessor must run on every
  component that uses `<T>`: it precomputes the translation hash and turns
  each child element and variable into a snippet `<T>` can rearrange.

  ```svelte
  <T context="Greeting">Hello, <b><Var>{name}</Var></b>!</T>
  ```
-->

<svelte:options preserveWhitespace={false} />

<script lang="ts">
  import { getI18nConfig } from 'gt-i18n/internal';
  import { untrack, type Snippet } from 'svelte';
  import GtNodes from './GtNodes.svelte';
  import { lookupJsxTranslation } from '../runtime/lookup';
  import type { GTRuntimeMetadata } from '@generaltranslation/svelte-extractor';
  import { validateTarget, type RenderContext } from '../runtime/nodes';
  import { setSourceContent } from '../runtime/source';
  import { getGTState } from '../runtime/state.svelte';
  import { warnInvalidTranslation, warnMissingPreprocessor } from '../runtime/warnings';

  type Props = {
    children?: Snippet;
    /** Disambiguates identical content for translators. */
    context?: string;
    /** A stable identifier for the entry. */
    id?: string;
    /** Maximum length of the translation. */
    maxChars?: number;
    /** Whether the translation requires approval before use. */
    requiresReview?: boolean;
    /** @internal Precomputed translation hash. */
    _hash?: string;
    /** @internal Variable keys and branch metadata. */
    _gtm?: GTRuntimeMetadata;
    [snippet: string]: unknown;
  };

  let {
    children,
    context,
    id,
    maxChars,
    requiresReview,
    _hash,
    _gtm,
    ...snippets
  }: Props = $props();

  const state = getGTState();

  if (untrack(() => _hash) === undefined) warnMissingPreprocessor();

  const target = $derived(
    _hash === undefined
      ? undefined
      : lookupJsxTranslation(state, {
          _hash,
          context,
          id,
          maxChars,
          requiresReview,
        })
  );

  const renderContext: RenderContext = $derived({
    snippets,
    meta: _gtm ?? {},
    locales: [state.locale, getI18nConfig().getDefaultLocale()],
  });

  const valid = $derived.by(() => {
    if (target === undefined) return false;
    if (validateTarget(target, [''], renderContext)) return true;
    warnInvalidTranslation(_hash);
    return false;
  });

  // Untranslated children render as source content, in the default locale.
  setSourceContent({
    get current() {
      return !valid;
    },
  });
</script>

{#if valid}
  <GtNodes nodes={target} scopes={['']} parent="" context={renderContext} />
{:else}
  {@render children?.()}
{/if}
