import { T, Currency } from 'gt-next';

export default function Page() {
  const price = 100;

  return (
    <T>
      The price is <Currency>{price}</Currency>
    </T>
  );
}
