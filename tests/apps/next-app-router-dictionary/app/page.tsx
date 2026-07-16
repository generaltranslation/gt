import { getLocale, getTranslations } from 'gt-next/server';
import { ClientDemo } from './client-demo';

type StringRecord = Record<string, string>;

export default async function Home() {
  const t = await getTranslations();
  const locale = await getLocale();
  const renderedAt = new Date().toISOString();
  const serverChecks = t.obj('server.checks') as StringRecord;

  return (
    <main className='page'>
      <section className='panel'>
        <p className='label'>{t('page.eyebrow')}</p>
        <h1>{t('page.title')}</h1>
        <p>{t('page.intro', { renderedAt })}</p>
        <div className='meta'>
          <span>Server locale: {locale}</span>
          <span>Rendered: {renderedAt}</span>
        </div>
      </section>

      <section className='panel'>
        <p className='label'>{t('server.eyebrow')}</p>
        <h2>{t('server.title')}</h2>
        <p>{t('server.body')}</p>
        <dl className='checks'>
          {Object.entries(serverChecks).map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <ClientDemo />
    </main>
  );
}
