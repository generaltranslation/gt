import { Html, Head, Main, NextScript } from 'next/document';

export default async function Document() {
  return (
    <Html lang='en'>
      <Head />
      <body className='antialiased'>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
