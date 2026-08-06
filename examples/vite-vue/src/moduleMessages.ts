import { t } from 'gt-vue';
import { GT, translateNow } from './i18n';

/** A translation resolved while this application module is evaluated. */
export const moduleGreeting = t('This sentence comes from module-level t().', {
  $context: 'module translation demo',
});

/** A module-level translation resolved through a local named re-export. */
export const reexportedModuleGreeting = translateNow(
  'Local re-exports also work with module-level t().',
  { $context: 'module translation re-export demo' }
);

/** A module-level translation resolved through the gt-vue namespace. */
export const namespacedModuleGreeting = GT.t(
  'Namespace calls also work with module-level t().',
  { $context: 'module translation namespace demo' }
);
