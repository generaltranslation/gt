import { Num, T } from 'gt-next';
import { getGT as getLegacyGT } from 'gt-next/server';
import { date, n, part, plural } from 'gt-next/unstable';
import { getGT } from 'gt-next/unstable/server';

type Order = { id: string; placedAt: Date; itemCount: number };

const orders: Order[] = [
  { id: 'A-1001', placedAt: new Date('2026-10-02'), itemCount: 1 },
  { id: 'A-1002', placedAt: new Date('2026-11-12'), itemCount: 5 },
];

export default async function OrdersPage() {
  const t = await getGT();
  const gt = await getLegacyGT();
  return (
    <section>
      <h1>{t`Your orders`}</h1>
      <ul>
        {orders.map((order) => (
          <li key={order.id}>
            <h2>{t`Order #${{ orderId: order.id }}`}</h2>
            <p>
              {t`Placed on ${date({ date: order.placedAt }, { style: 'long' })}`}
            </p>
            <p>
              {t`${plural(
                { count: order.itemCount },
                {
                  one: part`${n} item`,
                  other: part`${n} items`,
                }
              )}`}
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
