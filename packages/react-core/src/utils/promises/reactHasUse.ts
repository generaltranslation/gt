import * as React from 'react';

export const reactHasUse =
  typeof (React as typeof React & { use?: unknown }).use === 'function';
