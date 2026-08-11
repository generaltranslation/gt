import { RelativeTime, T } from 'gt-next';

export default function Page() {
  return (
    <T>
      Due <RelativeTime name='offset' value={3} unit='day' />.
    </T>
  );
}
