'use client';

import { useState } from 'react';
import { Branch, Currency, Num, Plural, T, useGT, Var } from 'gt-next';

const UNIT_PRICE = 189;
const FREE_SHIPPING_FROM = 2;
const SHIPPING = 12;
const FINISHES = ['graphite', 'paper', 'titanium'] as const;

type Finish = (typeof FINISHES)[number];

export function OrderPanel() {
  const gt = useGT();
  const [finish, setFinish] = useState<Finish>('graphite');
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(0);

  const finishNames: Record<Finish, string> = {
    graphite: gt('Graphite'),
    paper: gt('Paper'),
    titanium: gt('Titanium'),
  };
  const shipping = quantity >= FREE_SHIPPING_FROM ? 0 : SHIPPING;
  const total = quantity * UNIT_PRICE + shipping;

  return (
    <div className='order'>
      <div className='order-group' role='group' aria-labelledby='finish-label'>
        <p className='gt-label' id='finish-label'>
          {gt('Finish')}
        </p>
        <div className='finishes'>
          {FINISHES.map((option) => (
            <button
              key={option}
              type='button'
              className='finish'
              aria-pressed={finish === option}
              onClick={() => setFinish(option)}
            >
              <span className={`swatch swatch-${option}`} />
              {finishNames[option]}
            </button>
          ))}
        </div>
        <T>
          <Branch
            branch={finish}
            graphite={
              <p className='order-note'>
                Powder-coated steel with a black anodized head.
              </p>
            }
            paper={
              <p className='order-note'>
                Off-white powder coat with a brushed aluminum head.
              </p>
            }
            titanium={
              <p className='order-note'>
                Bead-blasted titanium arm with a graphite base.
              </p>
            }
          >
            <p className='order-note'>Steel arm and aluminum head.</p>
          </Branch>
        </T>
      </div>

      <div
        className='order-group'
        role='group'
        aria-labelledby='quantity-label'
      >
        <p className='gt-label' id='quantity-label'>
          {gt('Quantity')}
        </p>
        <div className='stepper'>
          <button
            type='button'
            aria-label={gt('Remove one lamp')}
            disabled={quantity <= 1}
            onClick={() => setQuantity(quantity - 1)}
          >
            −
          </button>
          <output aria-live='polite'>{quantity}</output>
          <button
            type='button'
            aria-label={gt('Add one lamp')}
            disabled={quantity >= 9}
            onClick={() => setQuantity(quantity + 1)}
          >
            +
          </button>
        </div>
        <T>
          <p className='order-note'>
            Shipping is free from <Num>{FREE_SHIPPING_FROM}</Num> lamps.
          </p>
        </T>
      </div>

      <div className='order-total'>
        <T>
          <p>
            <Plural
              n={quantity}
              one={<>One lamp</>}
              other={
                <>
                  <Num>{quantity}</Num> lamps
                </>
              }
            />{' '}
            in <Var>{finishNames[finish]}</Var>. Shipping{' '}
            <Currency currency='USD'>{shipping}</Currency>.
          </p>
        </T>
        <p className='total'>
          <Currency currency='USD'>{total}</Currency>
        </p>
      </div>

      <div className='order-actions'>
        <button
          type='button'
          className='gt-button'
          onClick={() => setAdded(added + quantity)}
        >
          {gt('Add To Cart')}
        </button>
        <p className='gt-label' aria-live='polite'>
          {added > 0
            ? gt(
                '{count, plural, one {# lamp} other {# lamps}} in your cart.',
                { count: added }
              )
            : gt('Ships from Rotterdam and Shenzhen.')}
        </p>
      </div>
    </div>
  );
}
