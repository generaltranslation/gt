import { t } from 'gt-react';

// A module-level string translated with t(). It resolves at import time
// because index.ts awaits initializeGTSPA() before importing the app.
export const kicker = t('Runtime internationalization for single-page apps.');
