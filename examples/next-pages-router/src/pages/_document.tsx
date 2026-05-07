import Document, { Html, Head, Main, NextScript } from 'next/document';
import type { ComponentType, ReactNode } from 'react';

type DocumentComponentProps = {
  children?: ReactNode;
};

const DocumentHead = Head as unknown as ComponentType<DocumentComponentProps>;
const DocumentNextScript =
  NextScript as unknown as ComponentType<DocumentComponentProps>;

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
