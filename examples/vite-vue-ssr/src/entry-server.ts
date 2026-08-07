import { renderToString, type SSRContext } from 'vue/server-renderer';
import { createDocsApp, createDocsGT } from './app';
import { getLocaleFromUrl } from './router';

export interface RenderResult {
  html: string;
  locale: string;
  teleports: string;
}

/**
 * Renders one request with a fresh app, router, and GT plugin.
 *
 * A GT plugin owns mutable locale state, so it must never be shared between
 * concurrent server requests. Translation data may be cached by an outer
 * loader, but each request still needs its own plugin instance.
 */
export async function render(url: string): Promise<RenderResult> {
  const gt = createDocsGT(getLocaleFromUrl(url));
  const { app } = await createDocsApp(url, true, gt);
  return renderApp(app, gt.getLocale());
}

async function renderApp(
  app: Awaited<ReturnType<typeof createDocsApp>>['app'],
  locale: string
): Promise<RenderResult> {
  const context: SSRContext = {};
  const html = await renderToString(app, context);
  return {
    html,
    locale,
    teleports: context.teleports?.['#teleports'] ?? '',
  };
}
