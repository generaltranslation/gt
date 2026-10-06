// One loopback login in a process of its own, the way `gt login` runs it:
// prints the redirect URI, settles the exchange after argv[2] ms, prints
// "settled", closes the server and returns. The process then ends as soon
// as nothing holds it open.
import { startLoopbackServer } from '../../loopback.js';

const exchangeMs = Number(process.argv[2] ?? 300);
const server = await startLoopbackServer();
const pending = server.waitForCallback(async (url) => {
  await new Promise((resolve) => setTimeout(resolve, exchangeMs));
  return url.href;
}, 10_000);
process.stdout.write(`${server.redirectUri}\n`);
await pending;
process.stdout.write('settled\n');
server.close();
