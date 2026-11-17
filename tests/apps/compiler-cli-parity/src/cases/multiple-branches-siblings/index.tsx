import { Branch } from 'gt-react';

export default function MultipleBranchesSiblings() {
  return (
    <div>
      Greeting: <Branch branch={'time' as string} morning="Good morning" evening="Good evening" other="Hello" />
      {', '}
      Status: <Branch branch={'mood' as string} happy="feeling great" sad="feeling down" other="okay" />
    </div>
  );
}
