import type { Handle } from '@sveltejs/kit/hooks';
import { getLocaleDirection, resolveLocale } from 'gt-svelte';
import '#lib/gt.ts';
import { getRequestLocales } from '#lib/server/locale.ts';

export const handle: Handle = ({ event, resolve }) => {
  const locale = resolveLocale(getRequestLocales(event.cookies, event.request));
  return resolve(event, {
    transformPageChunk: ({ html }) =>
      html
        .replace('%lang%', locale)
        .replace('%dir%', getLocaleDirection(locale)),
  });
};
