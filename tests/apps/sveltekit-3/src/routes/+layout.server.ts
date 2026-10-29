import { loadTranslations } from 'gt-svelte';
import '#lib/gt.ts';
import { getRequestLocales } from '#lib/server/locale.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies, request }) => ({
  gt: await loadTranslations(getRequestLocales(cookies, request)),
});
