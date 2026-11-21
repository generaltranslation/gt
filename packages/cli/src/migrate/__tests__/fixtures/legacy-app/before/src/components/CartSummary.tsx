import { Branch, Currency, DateTime, Num, Plural, T, Var } from 'gt-next';
import { stockLabels } from '../lib/messages';
import { useMessages } from 'gt-next';

type CartSummaryProps = {
  firstName: string;
  itemCount: number;
  total: number;
  discount: number;
  promoCode: string;
  deliveryDate: Date;
  status: 'pending' | 'shipped' | 'delivered';
};

export function CartSummary({
  firstName,
  itemCount,
  total,
  discount,
  promoCode,
  deliveryDate,
  status,
}: CartSummaryProps) {
  const m = useMessages();
  return (
    <section>
      <T context='Shopping cart heading'>
        <h2>Cart</h2>
      </T>
      <T>
        Hi <Var>{firstName}</Var>, <b>welcome back</b>! Check out{' '}
        <a href='/deals'>
          today&apos;s <em>deals</em>
        </a>
        .
      </T>
      <T>
        Your cart has <Num>{itemCount}</Num> items totaling{' '}
        <Currency currency='USD'>{total}</Currency>.
      </T>
      <T>
        <Plural
          n={itemCount}
          one={
            <>
              You have <Num>{itemCount}</Num> item in your cart.
            </>
          }
          other={
            <>
              You have <Num>{itemCount}</Num> items in your cart.
            </>
          }
        />
      </T>
      <T>
        Estimated delivery: <DateTime>{deliveryDate}</DateTime>
      </T>
      <T>
        Promo code <Var name='code'>{promoCode}</Var> saves you{' '}
        <Currency currency='EUR'>{discount}</Currency> on this order.
      </T>
      <T>
        <Branch
          branch={status}
          pending={
            <p>
              Your order is <strong>pending</strong>.
            </p>
          }
          shipped={
            <p>
              Your order has <strong>shipped</strong>!
            </p>
          }
        >
          <p>We are checking the status of your order.</p>
        </Branch>
      </T>
      <p>{m(stockLabels.lowStock)}</p>
      <button type='button'>
        <T $context='Remove an item from the cart' $maxChars={20}>
          Remove
        </T>
      </button>
      <a href='/checkout'>
        <T>Proceed to checkout</T>
      </a>
      <a href='/shop'>
        <T>Continue shopping</T>
      </a>
    </section>
  );
}
