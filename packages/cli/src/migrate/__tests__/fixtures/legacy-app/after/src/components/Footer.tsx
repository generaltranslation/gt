import { useTranslations } from 'gt-next/compat';
import { useGT } from 'gt-next/unstable';

export function Footer() {
  const d = useTranslations('footer');
  const t = useGT();
  const viewers = 12;
  return (
    <footer>
      <a href='/about'>{d('about')}</a>
      <a href='/careers'>{d('careers')}</a>
      <a href='/privacy'>{d('privacy')}</a>
      <section>
        <h4>{d('newsletter.title')}</h4>
        <p>{d('newsletter.subscribers', { count: 1200 })}</p>
        <button type='button'>{d('newsletter.subscribe')}</button>
      </section>
      <p>{t`${{ viewers }} shoppers are browsing right now`}</p>
      <small>{d('copyright', { year: new Date().getFullYear() })}</small>
    </footer>
  );
}
