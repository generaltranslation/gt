import { T, DateTime } from 'gt-next';

export default function Page() {
  const eventDate = new Date();

  return (
    <T>
      The event is on <DateTime>{eventDate}</DateTime>
    </T>
  );
}
