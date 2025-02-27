import { T as TNext, Num } from 'gt-next';
import { Num as NumNext } from 'gt-next';
import { T as TReact } from 'gt-react';

export default function TestStrings() {
  return <TReact id='exampleId'>TestStrings</TReact>;
}

export function TestT() {
  return (
    <>
      <TNext id='exampleId2'>TestStrings2</TNext>
      <TNext id='exampleId3'>
        Test <Num>{123}</Num>Strings3
      </TNext>
      <TNext id='exampleId4'>
        Test <NumNext>{123}</NumNext>Strings4
      </TNext>
    </>
  );
}
