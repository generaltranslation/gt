import { Branch, Plural, T } from 'gt-react';

export default function BranchEmptyFallback() {
  const count = 3;
  return (
    <div>
      <T>Before <Branch branch={'mode' as string}>{null}</Branch> after</T>
      <T>Earlier <Plural n={count}>{null}</Plural> later</T>
    </div>
  );
}
