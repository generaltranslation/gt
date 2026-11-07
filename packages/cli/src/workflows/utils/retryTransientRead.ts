import { isTransientApiError } from 'generaltranslation/api';

/** How many times a read is requested again after a transient API failure. */
export const TRANSIENT_READ_RETRIES = 3;

/** Waits 1s, 2s, then 4s before each retry. */
export const transientReadDelay = (retry: number) => 1000 * 2 ** retry;

export const wait = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Requests a read again while its API failure may clear; other failures, and
 * the last one, are thrown. Only for reads: a transient failure does not make
 * a write safe to replay.
 */
export async function retryTransientRead<T>(read: () => Promise<T>) {
  for (let retry = 0; ; retry++) {
    try {
      return await read();
    } catch (error) {
      if (retry >= TRANSIENT_READ_RETRIES || !isTransientApiError(error))
        throw error;
      await wait(transientReadDelay(retry));
    }
  }
}
