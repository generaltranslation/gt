import { hashStringSync } from './hash.js';

export const GT_DASHBOARD_URL = 'https://dash.generaltranslation.com';

export const GT_CONFIG_SCHEMA_URL = 'https://assets.gtx.dev/config-schema.json';

export const TEMPLATE_FILE_NAME = '__INTERNAL_GT_TEMPLATE_NAME__';
export const TEMPLATE_FILE_ID = hashStringSync(TEMPLATE_FILE_NAME);
