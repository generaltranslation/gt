// Injected as a `before-hydration` script by the gt-astro integration so the
// client-side GT runtime (config + translation cache) is initialized before
// any React island hydrates. Island providers receive locale and translations
// via serialized props; this module supplies the shared configuration.
import { initializeGT } from 'gt-react';
import { config, loadTranslations } from 'virtual:gt-astro/config-client';

initializeGT({ ...config, loadTranslations });
