export type RefreshTicket = {
  /** False once the scope this refresh was started for has changed. */
  isCurrent: () => boolean;
  /**
   * Marks this refresh done. Safe to call more than once. Returns whether
   * other refreshes are still in flight.
   */
  finish: () => boolean;
};

export type RefreshTracker = {
  /** True while any refresh started through this tracker is unfinished. */
  isRefreshing: () => boolean;
  begin: () => RefreshTicket;
};

/**
 * Coordinates overlapping translation status refreshes.
 *
 * A response may only write statuses while the scope it was requested for is
 * still current: a slow response for a previous scope (another locale
 * selection, document revision, or branch) would otherwise replace the
 * statuses of the current one. Responses for an unchanged scope are always
 * accepted, so refreshes slower than the polling interval still land instead
 * of being superseded forever.
 *
 * `getScope` must return a new value whenever the scope changes; it is
 * compared by identity.
 */
export function createRefreshTracker<T>(getScope: () => T): RefreshTracker {
  let inFlight = 0;

  return {
    isRefreshing: () => inFlight > 0,
    begin: () => {
      const scope = getScope();
      let finished = false;
      inFlight += 1;

      return {
        isCurrent: () => getScope() === scope,
        finish: () => {
          if (!finished) {
            finished = true;
            inFlight -= 1;
          }
          return inFlight > 0;
        },
      };
    },
  };
}
