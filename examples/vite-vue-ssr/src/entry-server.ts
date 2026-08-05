import { renderToString, type SSRContext } from 'vue/server-renderer';
import { createDocsApp, createDocsGT } from './app';
import { getLocaleFromUrl } from './router';

export interface RenderResult {
  html: string;
  locale: string;
  teleports: string;
}

export async function render(url: string): Promise<RenderResult> {
  const { app } = await createDocsApp(url, true);
  return renderApp(app, getLocaleFromUrl(url));
}

export async function createReusableRenderer() {
  const gt = createDocsGT('en');

  return async (url: string): Promise<RenderResult> => {
    const locale = getLocaleFromUrl(url);
    await gt.setLocale(locale);
    const { app } = await createDocsApp(url, true, gt);
    return renderApp(app, locale);
  };
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
