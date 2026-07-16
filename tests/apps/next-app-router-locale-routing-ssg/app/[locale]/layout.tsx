import type { Metadata } from 'next';
import { GTProvider } from 'gt-next';
import '../globals.css';
import { getLocale } from 'gt-next/server';

export const metadata: Metadata = {
  title: 'gt-next App Router Locale Routing SSG Test',
  description: 'Boilerplate app for testing gt-next locale routing with SSG',
};

export default async function LocaleLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={await getLocale()}>
      <body>
        <GTProvider>{children}</GTProvider>
      </body>
    </html>
  );
}
