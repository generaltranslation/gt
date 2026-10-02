import type { Metadata } from 'next';
import { GTProvider, LocaleSelector } from 'gt-next';
import { getGT, getLocale } from 'gt-next/server';
import { GtMark } from '../../components/gt-mark';
import '../globals.css';

const INTER_STYLESHEET =
  'https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,300..600&display=swap';

export async function generateMetadata(): Promise<Metadata> {
  const gt = await getGT();
  return {
    title: gt('Halden H2 desk lamp'),
    description: gt(
      'A desk lamp tuned from 2700 K to 6500 K. 96 LEDs, one diffuser, 9 watts.'
    ),
  };
}

export default async function LocaleLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gt = await getGT();

  return (
    <html lang={await getLocale()}>
      <head>
        {/* Next drops the remote @import in gt-brand.css, so load Inter here. */}
        <link rel='preconnect' href='https://fonts.googleapis.com' />
        <link
          rel='preconnect'
          href='https://fonts.gstatic.com'
          crossOrigin='anonymous'
        />
        <link rel='stylesheet' href={INTER_STYLESHEET} />
      </head>
      <body>
        <GTProvider>
          <div className='gt-frame'>
            <header className='gt-nav'>
              <div className='nav-start'>
                <a className='gt-mark' href='#top' aria-label='Halden'>
                  <GtMark />
                  <span>Halden</span>
                </a>
                <nav className='nav-links' aria-label={gt('Sections')}>
                  <a href='#specs'>{gt('Specs')}</a>
                  <a href='#order'>{gt('Order')}</a>
                  <a href='#shipping'>{gt('Shipping')}</a>
                  <a href='#reviews'>{gt('Reviews')}</a>
                </nav>
              </div>
              <LocaleSelector className='locale-select' />
              <span className='gt-cross bl' />
              <span className='gt-cross br' />
            </header>
            {children}
          </div>
        </GTProvider>
      </body>
    </html>
  );
}
