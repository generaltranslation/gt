<!--
  @component
  Translates its children. The gt-svelte preprocessor must run on every
  component that uses `<T>`: it precomputes the translation hash and turns
  each child element and variable into a snippet `<T>` can rearrange.

  ```svelte
  <T context="Greeting">Hello, <b><Var>{name}</Var></b>!</T>
  ```
-->
<script lang="ts">
  import type { JsxChildren } from '@generaltranslation/format/types';
  import { getI18nConfig } from 'gt-i18n/internal';
  import { untrack, type Snippet } from 'svelte';
  import GtNodes from './GtNodes.svelte';
  import { lookupJsxTranslation } from '../runtime/lookup';
  import {
    validateTarget,
    type GTRuntimeMetadata,
    type RenderContext,
  } from '../runtime/nodes';
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
    /** @internal Source children, emitted in development only. */
    _source?: JsxChildren;
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
    _source,
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
          _source,
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
</script>

{#if valid}
  <GtNodes nodes={target} scopes={['']} context={renderContext} />
{:else}
  {@render children?.()}
{/if}
