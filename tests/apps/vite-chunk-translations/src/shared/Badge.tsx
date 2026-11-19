import { T, t } from 'gt-react';

// Every route imports this module, so the bundler gives it a chunk of its
// own, with too few messages for a translations file of its own.
export function Badge() {
  return (
    <p data-test='badge'>
      <span>{t`Beta`}</span> <T>Shared by every route</T>
    </p>
  );
}

// Nothing imports these, so the bundler drops them, and their messages with
// them: no translations file may hold them.
export function UnusedBanner({ name }: { name: string }) {
  return (
    <p>
      {t`This banner is never rendered`} {t`Nobody greets ${{ name }} here`}
      <T>This element is never rendered either</T>
    </p>
  );
}
