'use client';

import { T, useGT as useLegacyGT } from 'gt-next';
import { useGT } from 'gt-next/unstable';

export function AccountSettings({
  passwordRotationDays,
}: {
  passwordRotationDays: number;
}) {
  const gt = useLegacyGT();
  const t = useGT();
  const save = t({ context: 'Save button in the settings form' });
  return (
    <form>
      <T context='Account settings page title'>
        <h2>Settings</h2>
      </T>
      <label>
        {gt('Email address')}
        <input type='email' />
      </label>
      <p>
        {t({
          context: 'Security tip',
        })`Update your password every ${{ days: passwordRotationDays }} days`}
      </p>
      <p>{t({ maxChars: 40 })`Changes are saved automatically.`}</p>
      <button type='submit'>{save`Save`}</button>
      <span>{t({ context: 'Discount label' })`Save`}</span>
      <button type='button'>{t({ maxChars: 24 })`Delete account`}</button>
    </form>
  );
}
