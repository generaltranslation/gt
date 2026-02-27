import { getLocale } from 'gt-next/server';
import { GTProvider } from 'gt-next';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body>
        <GTProvider>{children}</GTProvider>
      </body>
    </html>
  );
}
