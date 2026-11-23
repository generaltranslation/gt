import { Select, Plural, T } from 'gt-react';

export default function BranchEmptyFallback() {
  const count = 3;
  return (
    <div>
      <T>Before <Select value={'mode' as string}>{null}</Select> after</T>
      <T>Earlier <Plural n={count}>{null}</Plural> later</T>
    </div>
  );
}
