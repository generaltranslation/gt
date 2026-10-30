import 'server-only';

// Server-only dictionary (key-based) API. Initializes GT like gt-next/server.
import { initializeGTServer } from '../setup/initGT.server';
initializeGTServer();

export { getTranslations } from './getTranslations';
export type { TFunctionType } from 'gt-i18n/internal/compat';
