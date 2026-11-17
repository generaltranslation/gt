import { T, Plural } from 'gt-next';

export default function Page() {
  const count = 1;

  return (
    <T>
      <Plural n={count} one='You have one item' other='You have some items' />
    </T>
  );
}
