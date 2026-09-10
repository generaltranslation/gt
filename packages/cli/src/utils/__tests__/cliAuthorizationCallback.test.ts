import { describe, expect, it } from 'vitest';

import { createCliAuthorizationCallback } from '../cliAuthorizationCallback.js';

describe('CLI authorization callback', () => {
  it('accepts a code only when the browser returns the matching state', async () => {
    const callback = await createCliAuthorizationCallback();
    const code = callback.waitForCode('cli_expected');

    const wrongState = await fetch(
      `${callback.callbackUrl}?code=${'B'.repeat(43)}&state=cli_other`
    );
    const accepted = await fetch(
      `${callback.callbackUrl}?code=${'A'.repeat(43)}&state=cli_expected`
    );

    expect(wrongState.status).toBe(400);
    expect(accepted.status).toBe(200);
    await expect(code).resolves.toBe('A'.repeat(43));
  });

  it('closes the listener when authorization expires', async () => {
    const callback = await createCliAuthorizationCallback();

    await expect(callback.waitForCode('cli_expected', 10)).rejects.toThrow(
      'CLI authorization timed out'
    );
    await expect(fetch(callback.callbackUrl)).rejects.toThrow();
  });
});
