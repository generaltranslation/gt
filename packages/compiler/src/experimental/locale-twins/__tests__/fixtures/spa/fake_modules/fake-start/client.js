// Like TanStack Start's client entry: a library module that is the client
// build's entry and imports the app.
import { formatLabel } from 'fake-lib';
import { title } from '@app/main';

const FAKE_START_MARKER = 'fake-start client entry';

export const started = formatLabel(`${FAKE_START_MARKER} ${title}`);
