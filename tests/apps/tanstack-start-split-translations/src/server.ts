import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server';
import { createServerEntry } from '@tanstack/react-start/server-entry';

// CHECK_CDN, read when the server starts: the origin the app's assets are
// served from. scripts/check.mjs sets it to check that the files of split
// translations are requested where the chunks are. Empty, URLs are unchanged.
const handler = createStartHandler({
  handler: defaultStreamHandler,
  transformAssets: process.env.CHECK_CDN ?? '',
});

export default createServerEntry({ fetch: handler });
