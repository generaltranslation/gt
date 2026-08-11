import { DateTime, Num, T } from 'gt-next';

export default function Page() {
  const eventDate = new Date('2030-01-02T15:04:05.000Z');
  const attendees = 3;

  return (
    <T>
      Scheduled for <DateTime name='event'>{eventDate}</DateTime> with{' '}
      <Num name='attendees'>{attendees}</Num> attendees.
    </T>
  );
}
