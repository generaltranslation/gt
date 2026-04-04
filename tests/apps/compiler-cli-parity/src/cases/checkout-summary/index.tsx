import { Branch, Num } from 'gt-react';

export default function CheckoutSummary() {
  const subtotal = 89.97;
  const shipping = 5.99;
  const tax = 7.65;
  const total = 103.61;
  const hasPromo = true;
  const discount = 10;
  return (
    <div>
      <h3>Order Summary</h3>
      <table>
        <tbody>
          <tr>
            <td>Subtotal</td>
            <td>$<Num>{subtotal}</Num></td>
          </tr>
          <tr>
            <td>Shipping</td>
            <td>$<Num>{shipping}</Num></td>
          </tr>
          <tr>
            <td>Tax</td>
            <td>$<Num>{tax}</Num></td>
          </tr>
        </tbody>
      </table>
      {hasPromo && (
        <p>
          Promo applied: <strong>{discount}% off</strong>
        </p>
      )}
      <hr />
      <div>
        <strong>Total: $<Num>{total}</Num></strong>
      </div>
      <Branch branch="payment" card="Pay with Card" paypal="Pay with PayPal">
        Select payment method
      </Branch>
    </div>
  );
}
