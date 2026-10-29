import { t } from 'gt-react';

export default function ApiStandaloneT() {
  return (
    <div>
      <p>{t('Standalone message')}</p>
      <p>{t('Standalone with context', { $context: 'footer' })}</p>
      <p>{t('Count: {n}', { n: 4 })}</p>
    </div>
  );
}
