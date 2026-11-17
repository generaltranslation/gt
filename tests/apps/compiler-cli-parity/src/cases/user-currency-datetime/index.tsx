import { Currency, DateTime } from 'gt-react';

export default function UserCurrencyDateTime() {
  const amount = 9.99;
  const date = new Date();
  return (
    <div>
      Paid <Currency currency='USD'>{amount}</Currency> on <DateTime>{date}</DateTime>
    </div>
  );
}
