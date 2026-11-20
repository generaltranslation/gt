import { t } from 'gt-react';

// Only the minifier is told that this is false (CHECK_LATE_REMOVAL in
// vite.config.ts), so the call below is in the code the bundler renders and
// in no chunk of the build.
declare const __CHECK_DEBUG__: boolean;

if (__CHECK_DEBUG__) {
  console.warn(t`First late message`, t`Second late message`);
}

export const openFirst = () => import('./First');
export const openSecond = () => import('./Second');
