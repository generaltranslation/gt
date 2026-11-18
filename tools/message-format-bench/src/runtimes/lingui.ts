import { setupI18n, type Messages } from '@lingui/core';
import type { Runtime } from '../values.ts';

export const make: Runtime['make'] = (catalog: Messages) => {
  const i18n = setupI18n({ locale: 'en', messages: { en: catalog } });
  return (key, values) => i18n._(key, values);
};
