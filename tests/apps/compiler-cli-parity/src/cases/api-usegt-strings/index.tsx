import { useGT } from 'gt-react';

export default function ApiUseGTStrings({ name = 'Ada' }: { name?: string }) {
  const gt = useGT();
  return (
    <div>
      <p>{gt('Welcome back')}</p>
      <p>{gt('Hello, {name}!', { name })}</p>
      <p>{gt('Open', { $context: 'verb: open a file' })}</p>
      <p>{gt('Short label', { $maxChars: 12 })}</p>
      <p>
        {gt('You have {count, plural, one {# item} other {# items}}', {
          count: 2,
        })}
      </p>
    </div>
  );
}
