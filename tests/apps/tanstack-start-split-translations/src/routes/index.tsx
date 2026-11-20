import { createFileRoute } from '@tanstack/react-router';
import { Num, T, useGT } from 'gt-tanstack-start';

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  const t = useGT();
  return (
    <main data-page='home'>
      <h1 data-m data-src='Welcome back'>{t`Welcome back`}</h1>
      <p data-m data-src='You have 3 new reports'>
        <T>
          You have <Num>{3}</Num> new reports
        </T>
      </p>
    </main>
  );
}
