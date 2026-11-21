import { Num, T } from 'gt-next';
import { getGT } from 'gt-next/server';

type Order = { id: string; placedAt: Date; itemCount: number };

const orders: Order[] = [
  { id: 'A-1001', placedAt: new Date('2026-10-02'), itemCount: 1 },
  { id: 'A-1002', placedAt: new Date('2026-11-12'), itemCount: 5 },
];

export default async function OrdersPage() {
  const gt = await getGT();
  return (
    <section>
      <h1>{gt('Your orders')}</h1>
      <ul>
        {orders.map((order) => (
          <li key={order.id}>
            <h2>{gt('Order #{orderId}', { orderId: order.id })}</h2>
            <p>
              {gt('Placed on {date, date, long}', { date: order.placedAt })}
            </p>
            <p>
              {gt('{count, plural, one {# item} other {# items}}', {
                count: order.itemCount,
              })}
            </p>
            <a href={`/orders/${order.id}/track`}>{gt('Track package')}</a>
          </li>
        ))}
      </ul>
      <T>
        Need help with an order? <a href='/help'>Contact support</a> and we will
        get back to you within <Num>{24}</Num> hours.
      </T>
    </section>
  );
}
