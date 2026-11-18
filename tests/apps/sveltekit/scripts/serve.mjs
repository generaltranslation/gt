import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const appDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);

export async function freePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

/** Runs a command in the app directory and rejects when it fails. */
export function run(command, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: appDir,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0
        ? resolve(output)
        : reject(new Error(`${command} ${args.join(' ')} failed:\n${output}`))
    );
  });
}

/** Starts the adapter-node build and resolves once it answers requests. */
export async function startServer() {
  const port = await freePort();
  const child = spawn(process.execPath, ['build/index.js'], {
    cwd: appDir,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port) },
    stdio: 'ignore',
  });
  const url = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      await fetch(url);
      return { url, close: () => child.kill() };
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  child.kill();
  throw new Error(`The app server did not start at ${url}`);
}

export async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(appDir, relativePath), 'utf8'));
}

/** The server-rendered page without hydration markers or tags, as plain text. */
export async function pageText(url, locale) {
  const response = await fetch(url, {
    headers: { cookie: `generaltranslation.locale=${locale}` },
  });
  const html = await response.text();
  return html
    .replace(/<script[^]*?<\/script>/g, '')
    .replace(/<!--[^]*?-->/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ');
}
