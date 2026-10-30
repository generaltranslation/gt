import { createFileRoute } from '@tanstack/react-router';
import { msg, useMessages } from 'gt-tanstack-start/experimental';

// The loader returns msg() values. On a direct load the server runs it and
// the browser hydrates its dehydrated result (it does not run the loader
// again); after client-side navigation the browser runs it.
export const Route = createFileRoute('/harbor-notices')({
  loader: () => ({
    closure: msg('The north pier is closed for repairs.'),
    pilot: msg('Pilot {pilot} meets every ferry at dawn.', { pilot: 'Ada' }),
    welcome: msg('Welcome aboard, {traveler}!'),
  }),
  component: HarborNoticesPage,
});

function HarborNoticesPage() {
  const { closure, pilot, welcome } = Route.useLoaderData();
  const m = useMessages();

  return (
    <section className='panel' data-testid='loader-messages'>
      <p>{m(closure)}</p>
      <p>{m(pilot)}</p>
      <p>{m(welcome, { traveler: 'Grace' })}</p>
    </section>
  );
}
