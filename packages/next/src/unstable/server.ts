import 'server-only';

import { initializeGTServer } from '../setup/initGT.server';
initializeGTServer();

export { getGT, getMessages } from './getGT';
export { tx } from './tx';
export { dyn } from 'gt-i18n/unstable/internal';
