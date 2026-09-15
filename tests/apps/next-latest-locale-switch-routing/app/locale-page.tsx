import { getLocale } from 'gt-next/server';
import { ClientPanel } from './client-panel';
import { getContent } from './content';

export async function LocalePage({
  route,
}: {
  route: 'root' | 'nested' | 'restricted';
}) {
  const locale = await getLocale();
  const serverRenderId = crypto.randomUUID();

  return (
    <main>
      <h1>Latest Next.js locale switch test</h1>
      <p>Route: {route}</p>
      <p data-testid='server-render-id'>{serverRenderId}</p>
      <section>
        <h2>Server component</h2>
        <p>Server locale: {locale}</p>
        <p>Server content: {getContent(locale)}</p>
      </section>
      <ClientPanel />
    </main>
  );
}
