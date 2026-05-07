import Document, { Html, Head, Main, NextScript } from 'next/document';
import type { ComponentType } from 'react';

const DocumentHead = Head as unknown as ComponentType;
const DocumentNextScript = NextScript as unknown as ComponentType;

export default class MyDocument extends Document {
  render() {
    return (
      <Html lang='en'>
        <DocumentHead />
        <body className='antialiased'>
          <Main />
          <DocumentNextScript />
        </body>
      </Html>
    );
  }
}
