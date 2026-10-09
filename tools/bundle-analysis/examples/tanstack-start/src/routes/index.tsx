import { createFileRoute, Link } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { Currency, DateTime, getGT, Num, T, Var } from 'gt-tanstack-start';
import { KettleDrawing } from '../components/KettleDrawing';
import { OrderPanel } from '../components/OrderPanel';
import { Crosses } from '../components/Crosses';
import { Footer } from '../components/Footer';

const NEXT_BATCH = new Date('2026-11-09T09:00:00Z');
const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  dateStyle: 'medium',
  timeZone: 'UTC',
};

// Runs on the server: page metadata and shipping rows are translated with
// getGT before they reach the client.
const loadProductPage = createServerFn({ method: 'GET' }).handler(async () => {
  const gt = await getGT();
  const regions = [
    { name: gt('United States and Canada'), days: 5, cost: 15, from: 'RTM' },
    { name: gt('European Union and UK'), days: 2, cost: 8, from: 'RTM' },
    { name: gt('China and Japan'), days: 3, cost: 8, from: 'SZX' },
  ];

  return {
    title: gt('Ferro K1 pour-over kettle'),
    description: gt(
      'A gooseneck kettle that holds water within 1 °C of the target for up to 60 minutes.'
    ),
    regions: regions.map((region) => ({
      ...region,
      eta: gt('{days, plural, one {# business day} other {# business days}}', {
        days: region.days,
      }),
    })),
  };
});

export const Route = createFileRoute('/')({
  loader: () => loadProductPage(),
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.title },
      { name: 'description', content: loaderData?.description },
    ],
  }),
  component: Home,
});

function Home() {
  const { regions } = Route.useLoaderData();

  return (
    <main>
      <section className='gt-row flush'>
        <div className='gt-cells hero'>
          <div className='hero-copy'>
            <T>
              <p className='gt-label gt-mono'>Model K1, pour-over kettle</p>
            </T>
            <T>
              <h1>
                A kettle that holds water within <Num>{1}</Num> °C of the
                target.
              </h1>
            </T>
            <T>
              <p className='gt-lead'>
                Ferro K1 heats <Num>{0.9}</Num> liters to <Num>{96}</Num> °C in
                under <Num>{4}</Num> minutes on a <Num>{1200}</Num> watt base.
                The gooseneck pours at <Num>{8}</Num> milliliters per second.
              </p>
            </T>
            <div className='price-line'>
              <span className='price'>
                <Currency currency='USD'>{129}</Currency>
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
                <T>Configure Your Kettle</T>
              </a>
              <Link className='gt-button outline' to='/specs'>
                <T>See The Specs</T>
              </Link>
            </div>
          </div>
          <div className='figure'>
            <KettleDrawing />
          </div>
        </div>
        <Crosses />
      </section>

      <section className='gt-row flush'>
        <div className='gt-cells stats'>
          <T>
            <div className='stat'>
              <p className='stat-value'>
                <Num>{0.9}</Num>
                <span className='stat-unit'> L</span>
              </p>
              <p className='gt-label'>Capacity to the fill line</p>
            </div>
          </T>
          <T>
            <div className='stat'>
              <p className='stat-value'>
                <Num>{1}</Num>
                <span className='stat-unit'> °C</span>
              </p>
              <p className='gt-label'>Hold accuracy, measured at the spout</p>
            </div>
          </T>
          <T>
            <div className='stat'>
              <p className='stat-value'>
                <Num>{1200}</Num>
                <span className='stat-unit'> W</span>
              </p>
              <p className='gt-label'>Heating element, 120 V and 230 V</p>
            </div>
          </T>
          <T>
            <div className='stat'>
              <p className='stat-value'>
                <Num>{60}</Num>
                <span className='stat-unit'> min</span>
              </p>
              <p className='gt-label'>Longest hold before auto-off</p>
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
              <h2>Set a default preset before it ships.</h2>
              <p>
                The kettle boots to this temperature. You can change it later
                with the dial in <Num>{1}</Num> °C steps from <Num>{40}</Num> °C
                to <Num>{100}</Num> °C.
              </p>
            </T>
          </div>
          <OrderPanel />
        </div>
        <Crosses />
      </section>

      <section className='gt-row flush'>
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
                <span className='gt-label'>{region.eta}</span>
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

      <section className='gt-row flush'>
        <div className='gt-cells quotes'>
          <figure className='quote'>
            <T>
              <blockquote>
                It reaches 96 °C before my grinder finishes. The pour is steady
                enough for a 4 minute brew.
              </blockquote>
              <figcaption className='gt-label'>
                <Var>Mara Jensen</Var>, Copenhagen,{' '}
                <DateTime options={DATE_FORMAT}>
                  {new Date('2026-08-02T12:00:00Z')}
                </DateTime>
              </figcaption>
            </T>
          </figure>
          <figure className='quote'>
            <T>
              <blockquote>
                I keep it on the 80 °C preset for green tea. The hold timer
                means I stop reheating water.
              </blockquote>
              <figcaption className='gt-label'>
                <Var>Lin Hao</Var>, Hangzhou,{' '}
                <DateTime options={DATE_FORMAT}>
                  {new Date('2026-06-18T12:00:00Z')}
                </DateTime>
              </figcaption>
            </T>
          </figure>
        </div>
        <Crosses />
      </section>

      <Footer />
    </main>
  );
}
