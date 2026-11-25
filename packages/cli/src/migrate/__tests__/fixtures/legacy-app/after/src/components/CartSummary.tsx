'use client';

import { Branch, T, Var } from 'gt-next';
import {
  date,
  n,
  number,
  part,
  plural,
  useGT,
  useMessages,
} from 'gt-next/unstable';
import { stockLabels } from '../lib/messages';

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
  const t = useGT();
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
      <p>
        {t`Your cart has ${number(itemCount)} items totaling ${number(total, { style: 'currency', currency: 'USD' })}.`}
      </p>
      <p>
        {t`${plural(itemCount, {
          one: part`You have ${n} item in your cart.`,
          other: part`You have ${n} items in your cart.`,
        })}`}
      </p>
      <p>{t`Estimated delivery: ${date(deliveryDate)}`}</p>
      <p>
        {t`Promo code ${{ code: promoCode }} saves you ${number(discount, { style: 'currency', currency: 'EUR' })} on this order.`}
      </p>
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
      <p>{m(stockLabels.outOfStock)}</p>
      <button type='button'>
        <T $context='Remove an item from the cart' $maxChars={20}>
          Remove
        </T>
      </button>
      <a href='/checkout'>{t`Proceed to checkout`}</a>
      <a href='/shop'>
        <T>Continue shopping</T>
      </a>
    </section>
  );
}
