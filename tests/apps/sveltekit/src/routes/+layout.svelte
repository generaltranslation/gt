<script lang="ts">
  import '$lib/gt';
  import { GTProvider } from 'gt-svelte';
  import type { Snippet } from 'svelte';
  import type { LayoutData } from './$types';

  let { data, children }: { data: LayoutData; children: Snippet } = $props();
</script>

<GTProvider locale={data.gt.locale} translations={data.gt.translations}>
  {@render children()}
</GTProvider>
