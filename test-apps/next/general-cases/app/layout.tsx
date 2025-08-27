import { getLocale } from "gt-next/server";
import { GTProvider } from "gt-next";


export default async function RootLayout({
  children


}: Readonly<{children: React.ReactNode;}>) {
  return (
  <html lang={await getLocale()}>
      <body>
        <GTProvider>
          {children}
        </GTProvider>
      </body>
    </html>
  );
}