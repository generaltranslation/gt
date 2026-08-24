/** Waits for every operation before rethrowing the first failure. */
export async function settleAll(
  operations: Iterable<unknown | PromiseLike<unknown>>
): Promise<void> {
  const noFailure = Symbol('no failure');
  let firstFailure: unknown = noFailure;
  const trackedOperations = Array.from(operations, (operation) =>
    Promise.resolve(operation).catch((error) => {
      if (firstFailure === noFailure) firstFailure = error;
      throw error;
    })
  );

  await Promise.allSettled(trackedOperations);
  if (firstFailure !== noFailure) throw firstFailure;
}
