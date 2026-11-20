import { T, useGT } from 'gt-tanstack-start';

/** A module two routes share. */
export function Summary() {
  const t = useGT();
  return (
    <section data-component='summary'>
      <p data-m data-src='Totals for this week'>{t`Totals for this week`}</p>
      <p data-m data-src='Compared with last week'>
        <T>Compared with last week</T>
      </p>
    </section>
  );
}
