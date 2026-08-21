import {
  Branch,
  Currency,
  DateTime,
  Derive,
  Num,
  Plural,
  RelativeTime,
  T as Translate,
  Var,
} from 'gt-react';
import * as GT from 'gt-next';

function Card({ children }) {
  return <section data-kind='proof-card'>{children}</section>;
}

export default async function ProductionProof() {
  const user = await Promise.resolve('Ada');
  const count = 2;
  const amount = 49.95;
  const eventDate = new Date('2030-01-02T15:04:05.000Z');

  return (
    <>
      <Translate
        $context='production proof greeting'
        $id='production-proof-greeting'
        $maxChars={120}
        $requiresReview
      >
        Welcome, <Var name='user'>{user}</Var>!{' '}
        <Card>
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
        </Card>
      </Translate>

      <GT.T>
        Access:{' '}
        <Branch
          branch='admin'
          admin={
            <strong>
              administrator <GT.Var name='team'>Platform</GT.Var>
            </strong>
          }
          member='member'
        />
      </GT.T>

      <Translate>
        Scheduled for <DateTime name='event'>{eventDate}</DateTime>,{' '}
        <RelativeTime name='offset' value={3} unit='day' />.
      </Translate>

      <Translate>
        <Derive>
          <em>Derived JSX remains translatable</em>
        </Derive>
      </Translate>
    </>
  );
}
