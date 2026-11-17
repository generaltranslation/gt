'use client';

import { T, useGT } from 'gt-next';

export function AccountSettings({
  passwordRotationDays,
}: {
  passwordRotationDays: number;
}) {
  const gt = useGT();
  return (
    <form>
      <T $context='Account settings page title'>
        <h2>Settings</h2>
      </T>
      <label>
        {gt('Email address')}
        <input type='email' />
      </label>
      <p>
        {gt('Update your password every {days} days', {
          days: passwordRotationDays,
          $context: 'Security tip',
        })}
      </p>
      <T $maxChars={40}>Changes are saved automatically.</T>
      <button type='submit'>
        {gt('Save', { $context: 'Save button in the settings form' })}
      </button>
      <span>{gt('Save', { $context: 'Discount label, as in save 20%' })}</span>
      <button type='button'>{gt('Delete account', { $maxChars: 24 })}</button>
    </form>
  );
}
