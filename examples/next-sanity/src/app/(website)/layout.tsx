import type { Metadata } from 'next';
import { getLocaleDirection } from 'generaltranslation';
import { GTProvider } from 'gt-next';
import { getLocale } from 'gt-next/server';
import './globals.css';

export const metadata: Metadata = {
  title: 'GT + Next.js + Sanity',
  description: 'A minimal gt-next and embedded Sanity Studio example.',
};

export default async function WebsiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();

  return (
    <html lang={locale} dir={getLocaleDirection(locale)}>
      <body>
        <GTProvider>{children}</GTProvider>
      </body>
    </html>
  );
}
