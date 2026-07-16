'use client';

import { LocaleSelector, useLocale, useTranslations } from 'gt-next';

type StringRecord = Record<string, string>;

export function ClientDemo() {
  const t = useTranslations();
  const locale = useLocale();
  const features = t.obj('client.features') as StringRecord;

  return (
    <section className='panel'>
      <p className='label'>{t('client.eyebrow')}</p>
      <h2>{t('client.title')}</h2>
      <div className='meta'>
        <span>Client locale: {locale}</span>
      </div>
      <LocaleSelector />
      <p>{t('client.greeting', { name: 'Ada' })}</p>
      <ul className='feature-list'>
        {Object.entries(features).map(([key, value]) => (
          <li key={key}>{value}</li>
        ))}
      </ul>
    </section>
  );
}
