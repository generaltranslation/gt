import type { Metadata } from 'next';
import { GTProvider } from 'gt-next';
import { getLocale } from 'gt-next/server';
import './styles.css';

export const metadata: Metadata = {
  title: 'Latest Next.js locale switch compatibility test',
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang={await getLocale()}>
      <body>
        <GTProvider>{children}</GTProvider>
      </body>
    </html>
  );
}
