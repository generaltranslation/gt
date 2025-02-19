'use client';

import { useFormStatus } from 'react-dom';

import { LoaderIcon } from '@/components/icons';

import { Button } from './ui/button';
import { Var, T } from 'gt-next';

export function SubmitButton({
  children,
  isSuccessful,
}: {
  children: React.ReactNode;
  isSuccessful: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <T id='components.submit_button.2'>
      <Button
        type={pending ? 'button' : 'submit'}
        aria-disabled={pending || isSuccessful}
        disabled={pending || isSuccessful}
        className='relative'
      >
        <Var>{children}</Var>

        <Var>
          {(pending || isSuccessful) && (
            <span className='animate-spin absolute right-4'>
              <LoaderIcon />
            </span>
          )}
        </Var>

        <output aria-live='polite' className='sr-only'>
          <Var>
            {pending || isSuccessful ? (
              <T id='components.submit_button.0'>{'Loading'}</T>
            ) : (
              <T id='components.submit_button.1'>{'Submit form'}</T>
            )}
          </Var>
        </output>
      </Button>
    </T>
  );
}
