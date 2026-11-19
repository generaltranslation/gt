import { lazy, Suspense, useState } from 'react';
import { T, n, part, plural, t } from 'gt-react';
import type { RouteProps } from '../App';
import { Badge } from '../shared/Badge';
import { Glossary } from '../shared/Glossary';
import { OrderLines } from '../shared/OrderLines';

// A panel the route opens later, whose chunk imports this route's chunk
// statically (see OrderLines)
const Details = lazy(() => import('./OrderDetails'));

export default function Orders({ count }: RouteProps) {
  const [open, setOpen] = useState(false);
  return (
    <section data-route='orders'>
      <h2 data-test='heading'>{t`Recent orders`}</h2>
      <p data-test='orders'>
        {t`${plural({ count }, { one: part`${n} order is waiting`, other: part`${n} orders are waiting` })}`}
      </p>
      <T>
        <p data-test='jsx'>
          Orders ship within <b>two days</b>.
        </p>
      </T>
      <OrderLines />
      <button data-nav='details' onClick={() => setOpen(true)}>
        {t`Show details`}
      </button>
      {open && (
        <Suspense fallback={null}>
          <Details />
        </Suspense>
      )}
      <Badge />
      <Glossary />
    </section>
  );
}
