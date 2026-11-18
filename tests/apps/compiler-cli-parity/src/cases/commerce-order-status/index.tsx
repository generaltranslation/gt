import { Branch, Num } from 'gt-react';

export default function CommerceOrderStatus() {
  const order = {
    id: 'ORD-9821',
    status: 'shipped',
    total: 89.97,
    itemCount: 3,
    trackingNumber: '1Z999AA10123456784',
    estimatedDelivery: 'March 15, 2024',
    shippedDate: 'March 10, 2024',
  };

  return (
    <main>
      <header>
        <h1>Order #{order.id}</h1>
        <Branch
          branch={order.status}
          processing={<span>Processing</span>}
          shipped={<span>Shipped</span>}
          delivered={<span>Delivered</span>}
          cancelled={<span>Cancelled</span>}
        >
          <span>Unknown</span>
        </Branch>
      </header>

      <section>
        <h2>Order Timeline</h2>
        <ol>
          <li>
            <strong>Order placed</strong>
            <p>Your order has been confirmed.</p>
          </li>
          <li>
            <strong>Shipped</strong>
            <p>
              Your package was shipped on {order.shippedDate}.
            </p>
          </li>
          <li>
            <strong>Estimated delivery</strong>
            <p>
              Expected by {order.estimatedDelivery}.
            </p>
          </li>
        </ol>
      </section>

      {order.trackingNumber && (
        <section>
          <h3>Tracking Information</h3>
          <p>
            Tracking number: <code>{order.trackingNumber}</code>
          </p>
          <a href={`https://track.example.com/${order.trackingNumber}`}>
            Track your package
          </a>
        </section>
      )}

      <footer>
        <p>
          Order total: <strong>$<Num>{order.total}</Num></strong> ({order.itemCount} items)
        </p>
        <div>
          <a href="/orders">View all orders</a>
          <span> | </span>
          <a href="/help">Need help?</a>
        </div>
      </footer>
    </main>
  );
}
