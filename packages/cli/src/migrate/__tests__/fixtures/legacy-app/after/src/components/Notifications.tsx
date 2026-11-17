'use client';

import {
  date,
  n,
  number,
  part,
  plural,
  select,
  selectordinal,
  time,
  useGT,
} from 'gt-next/unstable';

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
  const t = useGT();
  return (
    <aside>
      <h3>
        {t`You have ${plural(
          { count },
          {
            one: part`${n} new notification`,
            other: part`${n} new notifications`,
          }
        )}`}
      </h3>
      <ul>
        <li>{t`${{ name: commenter }} commented on your post`}</li>
        <li>
          {t`${select({ gender }, { female: 'She', male: 'He', other: 'They' })} liked your photo`}
        </li>
        <li>
          {t`This is your ${selectordinal(
            { place: orderNumber },
            {
              one: part`${n}st`,
              two: part`${n}nd`,
              few: part`${n}rd`,
              other: part`${n}th`,
            }
          )} order with us`}
        </li>
        <li>
          {t`${plural(
            { count },
            {
              '=0': 'No unread messages',
              one: 'One unread message',
              other: part`${n} unread messages`,
            }
          )}`}
        </li>
      </ul>
      <p>
        {t`Your balance is ${number({ amount: balance }, { style: 'currency', currency: 'USD' })}`}
      </p>
      <p>
        {t`Last signed in ${date({ when: lastLogin }, { style: 'medium' })}`}
      </p>
      <p>
        {t`Order shipped at ${time({ time: shippedAt }, { style: 'short' })}`}
      </p>
      <p>
        {t`You are using ${number({ usage: storageUsage }, { style: 'percent' })} of your storage`}
      </p>
      <p>
        {t`${plural(trialDaysLeft, {
          one: part`${n} day`,
          other: part`${n} days`,
        })} left in your free trial`}
      </p>
      <button type='button'>{t`Mark all notifications as read`}</button>
    </aside>
  );
}
