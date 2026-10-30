import { T, useGT } from 'gt-tanstack-start/experimental';

/** Used by the home page and the lazy harbor guide page. */
export function SharedFooter() {
  const gt = useGT();

  return (
    <footer className='meta' data-testid='shared-footer'>
      <T>
        <span>The atlas is maintained by volunteer cartographers.</span>
      </T>
      <span>{gt('Report a broken beacon to the harbor office.')}</span>
    </footer>
  );
}
