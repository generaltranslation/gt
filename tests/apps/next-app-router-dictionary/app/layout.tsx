import type { Metadata } from 'next';
import { GTProvider } from 'gt-next';
import { GTDictionaryProvider } from 'gt-next/compat';
import { getLocale } from 'gt-next/server';
import './globals.css';

export const metadata: Metadata = {
  title: 'gt-next App Router Dictionary Test',
  description: 'Boilerplate app for testing gt-next App Router dictionaries',
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang={await getLocale()}>
      <body>
        <GTProvider>
          <GTDictionaryProvider>{children}</GTDictionaryProvider>
        </GTProvider>
      </body>
    </html>
  );
}
