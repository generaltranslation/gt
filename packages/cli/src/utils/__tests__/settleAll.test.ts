import { describe, expect, it } from 'vitest';
import { settleAll } from '../settleAll.js';

describe('settleAll', () => {
  it('waits for sibling operations before rethrowing a failure', async () => {
    const failure = new Error('failed');
    let siblingFinished = false;
    const sibling = new Promise<void>((resolve) => {
      setTimeout(() => {
        siblingFinished = true;
        resolve();
      }, 5);
    });

    await expect(settleAll([Promise.reject(failure), sibling])).rejects.toBe(
      failure
    );
    expect(siblingFinished).toBe(true);
  });

  it('rethrows the first observed failure', async () => {
    const firstFailure = new Error('failed first');
    const laterFailure = new Error('failed later');
    const earlierOperation = new Promise<void>((_resolve, reject) => {
      setTimeout(() => reject(laterFailure), 5);
    });

    await expect(
      settleAll([earlierOperation, Promise.reject(firstFailure)])
    ).rejects.toBe(firstFailure);
  });
});
