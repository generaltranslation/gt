/**
 * The locale routing module with locale twins: its locale switch navigates
 * to the locale's URL, a new document, so the locale twin reload keeps it
 * instead of reloading again. The experimental build resolves the regular
 * modules' `gt-tanstack-start/internal/localeRouting` imports here (see
 * tsdown.config.mts).
 */
import { markNavigatingReload } from 'gt-react/experimental';
import { createLocaleReload as createRegularLocaleReload } from 'gt-tanstack-start/internal/localeRouting';

export * from 'gt-tanstack-start/internal/localeRouting';

export function createLocaleReload(): ReturnType<
  typeof createRegularLocaleReload
> {
  const reload = createRegularLocaleReload();
  return reload && markNavigatingReload(reload);
}
