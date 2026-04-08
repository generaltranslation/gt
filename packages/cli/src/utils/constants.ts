import { hashStringSync } from './hash.js';

export const GT_DASHBOARD_URL = 'https://dash.generaltranslation.com';

export const GT_CONFIG_SCHEMA_URL = 'https://assets.gtx.dev/config-schema.json';

export const TEMPLATE_FILE_NAME = '__INTERNAL_GT_TEMPLATE_NAME__';
export const TEMPLATE_FILE_ID = hashStringSync(TEMPLATE_FILE_NAME);

export const DEFAULT_GIT_REMOTE_NAME = 'origin';

export const DEFAULT_TIMEOUT_SECONDS = 900;

// Number of source code lines to capture above and below a translation site
export const SURROUNDING_LINE_COUNT = 5;

// Default translations directory paths
export const DEFAULT_TRANSLATIONS_DIR = './public/_gt';
export const DEFAULT_VITE_TRANSLATIONS_DIR = './src/_gt';
