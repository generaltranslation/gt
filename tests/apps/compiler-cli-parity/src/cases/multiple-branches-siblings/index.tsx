import { Select } from 'gt-react';

export default function MultipleBranchesSiblings() {
  return (
    <div>
      Greeting: <Select value={'time' as string} morning="Good morning" evening="Good evening">Hello</Select>
      {', '}
      Status: <Select value={'mood' as string} happy="feeling great" sad="feeling down">okay</Select>
    </div>
  );
}
