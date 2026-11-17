import { Plural } from 'gt-react';

export default function PluralOrdinal() {
  const place = 2;
  return (
    <div>
      <Plural n={place} ordinal one="1st place" two="2nd place" few="3rd place" other="A later place" />
      <Plural n={place} ordinal={true} _1="Winner" other={<b>Place {place}</b>} />
      <Plural n={place} ordinal={false} one="1 place" other="Some places" />
    </div>
  );
}
