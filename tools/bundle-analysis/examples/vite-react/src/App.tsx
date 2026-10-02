import { useState } from 'react';
import {
  Branch,
  Currency,
  DateTime,
  LocaleSelector,
  Num,
  Plural,
  T,
  Var,
  msg,
  useGT,
  useLocale,
  useMessages,
} from 'gt-react';
import { GtMark } from './GtMark';

type Finish = 'graphite' | 'silver';

const UNIT_PRICE = 89;
const SHIP_DATE = new Date(2026, 10, 3);
const STOCK: Record<Finish, number> = { graphite: 12, silver: 1 };

const SPECS = [
  { value: 100, unit: 'W', label: msg('Power passthrough to your laptop') },
  { value: 4, unit: '', label: msg('USB-C ports, all full speed') },
  { value: 40, unit: 'Gbit/s', label: msg('Shared data bandwidth') },
  { value: 180, unit: 'g', label: msg('Weight without the cable') },
];

function Crosses() {
  return (
    <>
      <span className='gt-cross bl' aria-hidden='true' />
      <span className='gt-cross br' aria-hidden='true' />
    </>
  );
}

function DockDrawing() {
  return (
    <svg
      className='drawing'
      viewBox='0 0 360 220'
      role='img'
      aria-label='Halyard H4'
    >
      <g fill='none' stroke='currentColor' strokeWidth='1'>
        <rect x='40' y='60' width='280' height='96' />
        <rect x='52' y='72' width='256' height='72' opacity='0.35' />
        <rect x='88' y='100' width='28' height='12' />
        <rect x='136' y='100' width='28' height='12' />
        <rect x='184' y='100' width='28' height='12' />
        <rect x='232' y='100' width='28' height='12' />
        <circle cx='286' cy='106' r='3' />
        <path d='M40 182 H320 M40 176 V188 M320 176 V188' opacity='0.45' />
        <path d='M18 60 V156 M12 60 H24 M12 156 H24' opacity='0.45' />
      </g>
      <g className='drawing-label' fill='currentColor'>
        <text x='180' y='204' textAnchor='middle'>
          112 mm
        </text>
        <text x='10' y='112' textAnchor='end' transform='rotate(-90 10 112)'>
          38 mm
        </text>
        <text x='40' y='44'>
          H4
        </text>
      </g>
    </svg>
  );
}

export function App() {
  const gt = useGT();
  const m = useMessages();
  const locale = useLocale();
  const [finish, setFinish] = useState<Finish>('graphite');
  const [quantity, setQuantity] = useState(1);
  const [cartCount, setCartCount] = useState(0);

  const stock = STOCK[finish];
  const total = UNIT_PRICE * quantity;
  const [lastAdded, setLastAdded] = useState<Finish | null>(null);
  const finishName = (value: Finish) =>
    value === 'graphite' ? gt('Graphite') : gt('Silver');

  return (
    <div className='gt-frame'>
      <header className='gt-nav'>
        <a className='gt-mark' href='#top'>
          <GtMark />
          <span className='nav-divider' aria-hidden='true' />
          <span>Halyard</span>
        </a>
        <div className='nav-actions'>
          <span className='cart gt-mono'>
            {gt('Cart ({count})', { count: cartCount })}
          </span>
          <LocaleSelector />
        </div>
        <Crosses />
      </header>

      <main id='top'>
        <section className='gt-row gt-cells hero'>
          <div className='cell hero-copy'>
            <T>
              <p className='gt-label'>Desk hardware, model H4</p>
              <h1>One cable for the whole desk.</h1>
              <p className='gt-lead'>
                Halyard is a four-port USB-C dock. It passes 100 W to your
                laptop and fits in a jacket pocket.
              </p>
            </T>
            <div className='actions'>
              <a className='gt-button' href='#order'>
                {gt('Configure Yours')}
              </a>
              <a className='gt-button outline' href='#specs'>
                {gt('Read The Specs')}
              </a>
            </div>
            <T>
              <p className='price-line'>
                From <Currency currency='USD'>{UNIT_PRICE}</Currency>. Next
                batch ships{' '}
                <DateTime options={{ dateStyle: 'medium' }}>
                  {SHIP_DATE}
                </DateTime>
                .
              </p>
            </T>
          </div>
          <div className='cell plate'>
            <DockDrawing />
          </div>
          <Crosses />
        </section>

        <section id='specs' className='gt-row gt-cells specs'>
          {SPECS.map((spec) => (
            <div className='cell spec' key={spec.unit + spec.value}>
              <p className='spec-value'>
                <Num>{spec.value}</Num>
                {spec.unit && <span className='spec-unit'>{spec.unit}</span>}
              </p>
              <p className='gt-label'>{m(spec.label)}</p>
            </div>
          ))}
          <Crosses />
        </section>

        <div className='gt-hatch hatch' aria-hidden='true'>
          <Crosses />
        </div>

        <section id='order' className='gt-row gt-cells order'>
          <div className='cell'>
            <T>
              <p className='gt-label'>Configure</p>
              <h2>Pick a finish and a quantity.</h2>
            </T>

            <fieldset className='field'>
              <legend className='gt-label'>{gt('Finish')}</legend>
              <div className='segmented'>
                <button
                  type='button'
                  aria-pressed={finish === 'graphite'}
                  onClick={() => setFinish('graphite')}
                >
                  {finishName('graphite')}
                </button>
                <button
                  type='button'
                  aria-pressed={finish === 'silver'}
                  onClick={() => setFinish('silver')}
                >
                  {finishName('silver')}
                </button>
              </div>
              <T>
                <p className='note'>
                  <Branch
                    branch={finish}
                    graphite={
                      <>Anodized graphite aluminum with a bead-blasted top.</>
                    }
                    silver={
                      <>Brushed silver aluminum, milled from one block.</>
                    }
                  >
                    Anodized aluminum.
                  </Branch>
                </p>
              </T>
            </fieldset>

            <fieldset className='field'>
              <legend className='gt-label'>{gt('Quantity')}</legend>
              <div className='stepper'>
                <button
                  type='button'
                  aria-label={gt('Decrease quantity')}
                  disabled={quantity <= 1}
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                >
                  −
                </button>
                <output className='gt-mono'>
                  <Num>{quantity}</Num>
                </output>
                <button
                  type='button'
                  aria-label={gt('Increase quantity')}
                  disabled={quantity >= 9}
                  onClick={() => setQuantity((q) => Math.min(9, q + 1))}
                >
                  +
                </button>
              </div>
            </fieldset>
          </div>

          <div className='cell summary'>
            <T>
              <p className='gt-label'>Your order</p>
            </T>
            <dl className='summary-list'>
              <div>
                <dt>{gt('Items')}</dt>
                <dd>
                  <T>
                    <Plural
                      n={quantity}
                      one={<>One dock</>}
                      other={
                        <>
                          <Num>{quantity}</Num> docks
                        </>
                      }
                    />
                  </T>
                </dd>
              </div>
              <div>
                <dt>{gt('Subtotal')}</dt>
                <dd>
                  <Currency currency='USD'>{total}</Currency>
                </dd>
              </div>
              <div>
                <dt>{gt('Ships')}</dt>
                <dd>
                  <DateTime options={{ dateStyle: 'long' }}>
                    {SHIP_DATE}
                  </DateTime>
                </dd>
              </div>
            </dl>
            <T>
              <p className='note'>
                <Plural
                  n={stock}
                  one={<>One unit left in this finish.</>}
                  other={
                    <>
                      <Num>{stock}</Num> units left in this finish.
                    </>
                  }
                />
              </p>
            </T>
            <button
              type='button'
              className='gt-button add'
              onClick={() => {
                setCartCount((count) => count + quantity);
                setLastAdded(finish);
              }}
            >
              {gt('Add To Cart')}
            </button>
            {lastAdded && (
              <T>
                <p className='note confirm'>
                  Added the <Var>{finishName(lastAdded)}</Var> finish to your
                  cart. Checkout is disabled in this example.
                </p>
              </T>
            )}
          </div>
          <Crosses />
        </section>

        <section className='gt-row gt-cells box'>
          <div className='cell'>
            <T>
              <h3>In the box</h3>
              <p>
                The dock, a 1 m braided USB-C cable, and a felt pad for the
                underside.
              </p>
            </T>
          </div>
          <div className='cell'>
            <T>
              <h3>Compatibility</h3>
              <p>
                Works with any USB-C or Thunderbolt laptop. No driver install.
              </p>
            </T>
          </div>
          <div className='cell'>
            <T>
              <h3>Warranty</h3>
              <p>
                Two years on parts and labor. Repairs ship back within five
                business days.
              </p>
            </T>
          </div>
          <Crosses />
        </section>
      </main>

      <footer className='gt-row footer'>
        <T>
          <p className='gt-label'>
            Halyard is a fictional product. This page is a gt-react example.
          </p>
        </T>
        <span className='gt-mono locale-code'>{locale}</span>
        <Crosses />
      </footer>
    </div>
  );
}
