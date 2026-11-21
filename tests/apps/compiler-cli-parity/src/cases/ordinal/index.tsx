import { N, Num, Ordinal, Plural } from 'gt-react';

export default function OrdinalCase() {
  const place = 2;
  return (
    <div>
      <p><Ordinal n={place} one="1st place" two="2nd place" few="3rd place">A later place</Ordinal></p>
      <p><Plural n={place} one="1st place" two="2nd place" few="3rd place">A later place</Plural></p>
      <p><Ordinal n={place} _1="Winner" one={<b><Num>{place}</Num>st</b>}><b>Place {place}</b></Ordinal></p>
      <p><Ordinal n={place}>{null}</Ordinal></p>
      <p><Ordinal n={place} one={<b><N />st</b>}><N />th</Ordinal></p>
    </div>
  );
}
