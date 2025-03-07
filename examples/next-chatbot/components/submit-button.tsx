'use client';

import { useFormStatus } from 'react-dom';

import { LoaderIcon } from '@/components/icons';

import { Button } from './ui/button';
import { T } from 'gt-next';

export function SubmitButton({
  children,
  isSuccessful,
}: { children: React.ReactNode; isSuccessful: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type={pending ? 'button' : 'submit'}
      aria-disabled={pending || isSuccessful}
      disabled={pending || isSuccessful}
      className="relative"
    >
      {children}

      {(pending || isSuccessful) && (
        <span className="animate-spin absolute right-4">
          <LoaderIcon />
        </span>
      )}

      <output aria-live="polite" className="sr-only">
        {pending || isSuccessful ? (
          <T id="components.submit_button.0">{'Loading'}</T>
        ) : (
          <T id="components.submit_button.1">{'Submit form'}</T>
        )}
      </output>
    </Button>
  );
}
