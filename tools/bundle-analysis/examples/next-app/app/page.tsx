import { Currency, DateTime, Num, T, Var } from 'gt-next';
import { getGT } from 'gt-next/server';
import { LampDrawing } from '../components/lamp-drawing';
import { OrderPanel } from '../components/order-panel';

const NEXT_BATCH = new Date('2026-11-16T09:00:00Z');
const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  dateStyle: 'medium',
  timeZone: 'UTC',
};

function Crosses() {
  return (
    <>
      <span className='gt-cross bl' />
      <span className='gt-cross br' />
    </>
  );
}

export default async function Home() {
  const gt = await getGT();

  const regions = [
    { name: gt('United States and Canada'), days: 4, cost: 12, from: 'RTM' },
    { name: gt('European Union and UK'), days: 2, cost: 9, from: 'RTM' },
    { name: gt('China and Singapore'), days: 3, cost: 9, from: 'SZX' },
  ];

  return (
    <main id='top'>
      <section className='gt-row flush'>
        <div className='gt-cells hero'>
          <div className='hero-copy'>
            <T>
              <p className='gt-label gt-mono'>Model H2, desk lamp</p>
            </T>
            <T>
              <h1>
                One desk lamp, tuned from <Num>{2700}</Num> K to{' '}
                <Num>{6500}</Num> K.
              </h1>
            </T>
            <T>
              <p className='gt-lead'>
                Halden H2 puts <Num>{96}</Num> LEDs behind a single diffuser. It
                draws <Num>{9}</Num> watts at full output and <Num>{0.3}</Num>{' '}
                watts in standby.
              </p>
            </T>
            <div className='price-line'>
              <span className='price'>
                <Currency currency='USD'>{189}</Currency>
              </span>
              <T>
                <span className='gt-label'>
                  Next batch ships{' '}
                  <DateTime options={DATE_FORMAT}>{NEXT_BATCH}</DateTime>
                </span>
              </T>
            </div>
            <div className='actions'>
              <a className='gt-button' href='#order'>
                {gt('Configure Your Lamp')}
              </a>
              <a className='gt-button outline' href='#specs'>
                {gt('Read The Specs')}
              </a>
            </div>
          </div>
          <div className='figure'>
            <LampDrawing />
          </div>
        </div>
        <Crosses />
      </section>

      <section className='gt-row flush' id='specs'>
        <div className='gt-cells stats'>
          <T>
            <div className='stat'>
              <p className='stat-value'>
                <Num>{800}</Num>
                <span className='stat-unit'> lm</span>
              </p>
              <p className='gt-label'>Peak output at 4000 K</p>
            </div>
          </T>
          <T>
            <div className='stat'>
              <p className='stat-value'>
                <Num>{97}</Num>
                <span className='stat-unit'> CRI</span>
              </p>
              <p className='gt-label'>Color rendering index, Ra</p>
            </div>
          </T>
          <T>
            <div className='stat'>
              <p className='stat-value'>
                <Num>{50000}</Num>
                <span className='stat-unit'> h</span>
              </p>
              <p className='gt-label'>Rated LED life to L70</p>
            </div>
          </T>
          <T>
            <div className='stat'>
              <p className='stat-value'>
                <Num>{1.4}</Num>
                <span className='stat-unit'> kg</span>
              </p>
              <p className='gt-label'>Weight with the steel base</p>
            </div>
          </T>
        </div>
        <Crosses />
      </section>

      <div className='gt-hatch' aria-hidden='true' />

      <section className='gt-row flush' id='order'>
        <div className='gt-cells split'>
          <div className='cell'>
            <T>
              <p className='gt-label'>Order</p>
              <h2>Pick a finish and a quantity.</h2>
              <p>
                Every lamp ships with a <Num>{30}</Num> watt USB-C power supply
                and a <Num>{5}</Num> year warranty. The head and arm are
                replaceable parts.
              </p>
            </T>
          </div>
          <div className='cell'>
            <OrderPanel />
          </div>
        </div>
        <Crosses />
      </section>

      <section className='gt-row flush' id='shipping'>
        <div className='gt-cells split'>
          <div className='cell'>
            <T>
              <p className='gt-label'>Shipping</p>
              <h2>Two warehouses, three regions.</h2>
              <p>
                Orders placed before <Var>14:00</Var> local time leave the same
                day. Duties are included in the price.
              </p>
            </T>
          </div>
          <ul className='regions'>
            {regions.map((region) => (
              <li key={region.name} className='region'>
                <span className='region-name'>{region.name}</span>
                <span className='gt-label'>
                  {gt(
                    '{days, plural, one {# business day} other {# business days}}',
                    { days: region.days }
                  )}
                </span>
                <span className='region-cost'>
                  <Currency currency='USD'>{region.cost}</Currency>
                </span>
                <span className='gt-mono region-code'>{region.from}</span>
              </li>
            ))}
          </ul>
        </div>
        <Crosses />
      </section>

      <div className='gt-hatch' aria-hidden='true' />

      <section className='gt-row' id='reviews'>
        <div className='section-head'>
          <T>
            <p className='gt-label'>Reviews</p>
            <h2>
              Rated <Num>{4.8}</Num> out of 5 by <Num>{1284}</Num> owners.
            </h2>
          </T>
        </div>
        <Crosses />
      </section>

      <section className='gt-row flush'>
        <div className='gt-cells quotes'>
          <figure className='quote'>
            <T>
              <blockquote>
                I set it to 3200 K for evening reading and have not touched the
                dial since.
              </blockquote>
              <figcaption className='gt-label'>
                <Var>Ines Duarte</Var>, Lisbon,{' '}
                <DateTime options={DATE_FORMAT}>
                  {new Date('2026-08-21T12:00:00Z')}
                </DateTime>
              </figcaption>
            </T>
          </figure>
          <figure className='quote'>
            <T>
              <blockquote>
                The arm holds position at full extension. My last lamp drooped
                within a month.
              </blockquote>
              <figcaption className='gt-label'>
                <Var>Wei Chen</Var>, Shenzhen,{' '}
                <DateTime options={DATE_FORMAT}>
                  {new Date('2026-07-03T12:00:00Z')}
                </DateTime>
              </figcaption>
            </T>
          </figure>
          <figure className='quote'>
            <T>
              <blockquote>
                No flicker on camera at any brightness. I use two of them for
                video calls.
              </blockquote>
              <figcaption className='gt-label'>
                <Var>Paul Moreau</Var>, Lyon,{' '}
                <DateTime options={DATE_FORMAT}>
                  {new Date('2026-09-12T12:00:00Z')}
                </DateTime>
              </figcaption>
            </T>
          </figure>
        </div>
        <Crosses />
      </section>

      <footer className='gt-row footer'>
        <T>
          <p className='gt-label'>
            Halden is a fictional product. This page is an example app for
            measuring General Translation bundle size.
          </p>
        </T>
        <p className='gt-label gt-mono'>gt-next</p>
        <Crosses />
      </footer>
    </main>
  );
}
