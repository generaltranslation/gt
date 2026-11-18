import { Plural } from 'gt-react';

export default function PluralChildrenOnly() {
  const n = 1;
  return (
    <div>
      <Plural n={n}>
        Default content
      </Plural>
    </div>
  );
}
