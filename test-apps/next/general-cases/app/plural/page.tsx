import { T, Plural } from 'gt-next';

export default function Page() {
  const count = 1;
  
  return (
    <T>
      <Plural n={count}
        singular="You have one item"
        plural="You have some items"
      />
    </T>
  );
}