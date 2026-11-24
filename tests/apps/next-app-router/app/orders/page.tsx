import Link from 'next/link';
import { T } from 'gt-next';
import { SharedClient } from '../shared-client';
import { OrdersClient } from './orders-client';

export default function Orders() {
  return (
    <main className='page'>
      <section className='panel'>
        <p className='label'>Server component of the orders page</p>
        <T>
          <p>This paragraph is translated in the orders page on the server.</p>
        </T>
        <Link href='/'>Home</Link>
      </section>
      <OrdersClient />
      <SharedClient />
    </main>
  );
}
