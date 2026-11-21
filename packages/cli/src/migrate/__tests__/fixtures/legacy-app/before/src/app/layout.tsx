import type { ReactNode } from 'react';
import { GTProvider } from 'gt-next';
import { getLocale } from 'gt-next/server';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body>
        <GTProvider>
          <Header />
          <main>{children}</main>
          <Footer />
        </GTProvider>
      </body>
    </html>
  );
}
