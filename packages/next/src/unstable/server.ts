import 'server-only';

import { initializeGTServer } from '../setup/initGT.server';
initializeGTServer();

export { getGT, getMessages } from './getGT';
