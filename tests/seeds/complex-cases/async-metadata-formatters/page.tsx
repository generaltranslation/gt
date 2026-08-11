import type { ReactNode } from 'react';
import { Currency, Num, Plural, T, Var } from 'gt-next';

function Summary({ children }: { children: ReactNode }) {
  return <section data-kind='summary'>{children}</section>;
}

export default async function Page() {
  const user = await Promise.resolve('Ada');
  const count = 2;
  const amount = 49.95;

  return (
    <T
      context='async cart summary'
      id='async-cart-summary'
      maxChars={120}
    >
      Welcome, <Var name='user'>{user}</Var>!{' '}
      <Summary>
        Your cart has <Num name='count'>{count}</Num>{' '}
        <Plural
          n={count}
          one='item'
          other={
            <>
              items worth{' '}
              <Currency name='total' currency='USD'>
                {amount * count}
              </Currency>
            </>
          }
        />
      </Summary>
    </T>
  );
}
