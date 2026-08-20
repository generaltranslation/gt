import { LocaleSelector, T, withGTStaticProps } from 'gt-next';

export const getStaticProps = withGTStaticProps();

export default function Home() {
  return (
    <div>
      <T id='pages.index.0'>
        <div>Hello, world!</div>
        <LocaleSelector />
      </T>
    </div>
  );
}
