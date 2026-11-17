'use client';

import { useGT } from 'gt-next';

type NotificationsProps = {
  count: number;
  commenter: string;
  gender: 'female' | 'male' | 'other';
  orderNumber: number;
  balance: number;
  lastLogin: Date;
  storageUsage: number;
  trialDaysLeft: number;
  shippedAt: Date;
};

export function Notifications({
  count,
  commenter,
  gender,
  orderNumber,
  balance,
  lastLogin,
  storageUsage,
  trialDaysLeft,
  shippedAt,
}: NotificationsProps) {
  const gt = useGT();
  return (
    <aside>
      <h3>
        {gt(
          'You have {count, plural, one {# new notification} other {# new notifications}}',
          { count }
        )}
      </h3>
      <ul>
        <li>{gt('{name} commented on your post', { name: commenter })}</li>
        <li>
          {gt(
            '{gender, select, female {She} male {He} other {They}} liked your photo',
            { gender }
          )}
        </li>
        <li>
          {gt(
            'This is your {place, selectordinal, one {#st} two {#nd} few {#rd} other {#th}} order with us',
            { place: orderNumber }
          )}
        </li>
        <li>
          {gt(
            '{count, plural, =0 {No unread messages} one {One unread message} other {# unread messages}}',
            { count }
          )}
        </li>
      </ul>
      <p>
        {gt('Your balance is {amount, number, ::currency/USD}', {
          amount: balance,
        })}
      </p>
      <p>{gt('Last login: {when, date, medium}', { when: lastLogin })}</p>
      <p>{gt('Order shipped at {time, time, short}', { time: shippedAt })}</p>
      <p>
        {gt('You are using {usage, number, percent} of your storage', {
          usage: storageUsage,
        })}
      </p>
      <p>
        {gt(
          '{days, plural, one {# day} other {# days}} left in your free trial',
          { days: trialDaysLeft }
        )}
      </p>
      <button type='button'>{gt('Mark all as read')}</button>
    </aside>
  );
}
