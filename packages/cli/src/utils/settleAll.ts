/** Waits for every operation before rethrowing the first failure. */
export async function settleAll(
  operations: Iterable<unknown | PromiseLike<unknown>>
): Promise<void> {
  const results = await Promise.allSettled(operations);
  const failure = results.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected'
  );
  if (failure) throw failure.reason;
}
