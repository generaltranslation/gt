import { Var, Plural, Num } from 'gt-react';

export default function EcommerceCart() {
  const items = [
    { name: 'Widget', qty: 2, price: 19.99 },
    { name: 'Gadget', qty: 1, price: 49.99 },
  ];
  const total = 89.97;
  const itemCount = 3;
  return (
    <div>
      <h2>Shopping Cart</h2>
      <div>
        {items.map((item) => (
          <div key={item.name}>
            <span>{item.name}</span>
            <span>Qty: <Num>{item.qty}</Num></span>
            <span>$<Num>{item.price}</Num></span>
          </div>
        ))}
      </div>
      <hr />
      <div>
        <p>
          <Plural n={itemCount} one="1 item" other="items" /> in your cart
        </p>
        <p>
          Subtotal: $<Var>{total.toFixed(2)}</Var>
        </p>
        <p>Shipping calculated at checkout.</p>
        <button>Proceed to Checkout</button>
        <a href="/products">Continue Shopping</a>
      </div>
    </div>
  );
}
