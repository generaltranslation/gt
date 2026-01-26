import { T, Num } from 'gt-next';

export default function Page() {
  const quantity = 100;

  return (
    <T>
      There are <Num>{quantity}</Num> units available
    </T>
  );
}
