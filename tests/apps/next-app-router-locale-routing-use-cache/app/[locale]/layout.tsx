import type { Metadata } from 'next';
import { GTProvider } from 'gt-next';
import '../globals.css';

export const metadata: Metadata = {
  title: 'gt-next App Router Locale Routing Cache Components Test',
  description:
    'Boilerplate app for testing gt-next locale routing with Cache Components',
};

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  return (
    <html lang={locale}>
      <body>
        <GTProvider>{children}</GTProvider>
      </body>
    </html>
  );
}
