import { T, useGT } from 'gt-tanstack-start';

/** Imported when its button is clicked. */
export function Dialog() {
  const t = useGT();
  return (
    <div data-component='dialog'>
      <p data-m data-src='Export this report'>{t`Export this report`}</p>
      <p data-m data-src='Choose a file format'>
        <T>Choose a file format</T>
      </p>
    </div>
  );
}
