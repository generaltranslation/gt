import { Branch } from 'gt-react';

export default function MultipleBranchesSiblings() {
  return (
    <div>
      Greeting: <Branch branch="time" morning="Good morning" evening="Good evening">Hello</Branch>
      {', '}
      Status: <Branch branch="mood" happy="feeling great" sad="feeling down">okay</Branch>
    </div>
  );
}
