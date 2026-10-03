import { spawn, type ChildProcess } from 'node:child_process';
import { request } from 'node:http';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { CALLBACK_RETRY_HOLD_MS } from '../loopback.js';

const fixture = (name: string) =>
  fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

type Login = {
  child: ChildProcess;
  /** Resolves with each line the child prints, in order. */
  line: () => Promise<string>;
  /** Resolves with the time the child exited, in ms since the epoch. */
  exited: Promise<number>;
};

let running: ChildProcess | undefined;

afterEach(() => {
  running?.kill();
  running = undefined;
});

/** Runs one loopback login in its own process, the retry client staying in this one. */
function startLogin(exchangeMs: number): Login {
  const child = spawn(
    process.execPath,
    [
      '--import',
      fixture('ts-source-hooks.mjs'),
      fixture('loopback-login.mjs'),
      String(exchangeMs),
    ],
    { stdio: ['ignore', 'pipe', 'inherit'] }
  );
  running = child;
  const lines = createInterface({ input: child.stdout! })[
    Symbol.asyncIterator
  ]();
  return {
    child,
    line: async () => String((await lines.next()).value),
    exited: new Promise((resolve) =>
      child.once('exit', () => resolve(Date.now()))
    ),
  };
}

/** A GET whose connection this side drops after `abortMs`, as a browser abandons a navigation. */
function abandonedGet(url: string, abortMs: number): Promise<void> {
  return new Promise((resolve) => {
    const req = request(url, () => undefined);
    req.on('error', () => resolve());
    req.end();
    setTimeout(() => {
      req.destroy();
      resolve();
    }, abortMs);
  });
}

describe('loopback login in its own process', () => {
  it('stays up for the repeat of a navigation abandoned during the exchange, then exits', async () => {
    const login = startLogin(400);
    const callback = `${await login.line()}?code=abc&state=xyz`;
    await abandonedGet(callback, 50);
    expect(await login.line()).toBe('settled');

    // The browser repeats the navigation after the exchange settled.
    await new Promise((resolve) => setTimeout(resolve, 100));
    const repeat = await fetch(callback);
    const answered = Date.now();
    expect(repeat.status).toBe(200);
    expect(await repeat.text()).toContain('Signed in to the gt CLI');
    // Once the repeat has its page, nothing holds the process open.
    expect((await login.exited) - answered).toBeLessThan(
      CALLBACK_RETRY_HOLD_MS
    );
  });

  it('keeps the hold through a repeat that was abandoned too', async () => {
    const login = startLogin(700);
    const callback = `${await login.line()}?code=abc&state=xyz`;
    await abandonedGet(callback, 75);
    await abandonedGet(callback, 75);
    expect(await login.line()).toBe('settled');

    await new Promise((resolve) => setTimeout(resolve, 100));
    const repeat = await fetch(callback);
    expect(repeat.status).toBe(200);
    expect(await repeat.text()).toContain('Signed in to the gt CLI');
    await login.exited;
  });
  it('exits as soon as the login returns when the browser received the page', async () => {
    const login = startLogin(50);
    const callback = `${await login.line()}?code=abc&state=xyz`;
    const page = await fetch(callback);
    expect(page.status).toBe(200);
    expect(await login.line()).toBe('settled');
    const settled = Date.now();
    expect((await login.exited) - settled).toBeLessThan(2000);
  });
});
