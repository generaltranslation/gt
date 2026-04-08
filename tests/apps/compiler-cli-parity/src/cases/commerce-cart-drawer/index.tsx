import { Num, Plural } from 'gt-react';

export default function CommerceCartDrawer() {
  const items = [
    { id: '1', title: 'Wireless Headphones', variant: 'Black', quantity: 1, price: 79.99, image: '/headphones.jpg' },
    { id: '2', title: 'Phone Case', variant: 'Clear', quantity: 2, price: 14.99, image: '/case.jpg' },
  ];
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const freeShippingThreshold = 100;
  const remaining = freeShippingThreshold - subtotal;
  const hasFreeShipping = remaining <= 0;

  return (
    <aside>
      <header>
        <h2>Your Cart</h2>
        <span>
          (<Plural n={itemCount} one="1 item" other="items" />)
        </span>
        <button aria-label="Close cart">X</button>
      </header>

      {items.length === 0 ? (
        <div>
          <p>Your cart is empty.</p>
          <a href="/collections">Continue shopping</a>
        </div>
      ) : (
        <>
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                <img src={item.image} alt={item.title} />
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.variant}</p>
                  <div>
                    <button>-</button>
                    <span>{item.quantity}</span>
                    <button>+</button>
                  </div>
                  <p>$<Num>{item.price}</Num></p>
                </div>
                <button aria-label="Remove item">Remove</button>
              </li>
            ))}
          </ul>

          {!hasFreeShipping && (
            <p>
              Add $<Num>{remaining}</Num> more for free shipping!
            </p>
          )}

          <footer>
            <div>
              <span>Subtotal</span>
              <span>$<Num>{subtotal}</Num></span>
            </div>
            <p>Taxes and shipping calculated at checkout.</p>
            <button>Checkout — $<Num>{subtotal}</Num></button>
            <a href="/collections">Continue shopping</a>
          </footer>
        </>
      )}
    </aside>
  );
}
