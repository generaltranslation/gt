import { createFileRoute } from '@tanstack/react-router';
import { T, useGT } from 'gt-tanstack-start';
import { Summary } from '../components/Summary';

export const Route = createFileRoute('/settings')({
  component: Settings,
});

function Settings() {
  const t = useGT();
  return (
    <main data-page='settings'>
      <h1 data-m data-src='Account settings'>{t`Account settings`}</h1>
      <p data-m data-src='Change your password'>
        <T>Change your password</T>
      </p>
      <Summary />
    </main>
  );
}
