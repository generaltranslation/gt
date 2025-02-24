import Form from 'next/form';

import { signOut } from '@/app/(auth)/auth';
import { T } from 'gt-next';

export const SignOutForm = () => {
  return (
    <T id="components.sign_out_form.0">
      <Form
        className="w-full"
        action={async () => {
          'use server';

          await signOut({
            redirectTo: '/',
          });
        }}
      >
        <button
          type="submit"
          className="w-full text-left px-1 py-0.5 text-red-500"
        >
          Sign out
        </button>
      </Form>
    </T>
  );
};
