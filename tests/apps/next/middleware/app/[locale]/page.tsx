import { getLocale } from 'gt-next/server';
import LocaleSwitcher from '../../components/LocaleSwitcher';
import LocaleDisplay from '../../components/LocaleDisplay';

export default async function Home() {
  const locale = await getLocale();
  return (
    <main>
      <h1 data-testid="page-title">Home</h1>
      <p data-testid="server-locale">{locale}</p>
      <LocaleDisplay />
      <LocaleSwitcher />
    </main>
  );
}
