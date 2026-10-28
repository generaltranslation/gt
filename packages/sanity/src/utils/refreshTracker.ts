export type RefreshTicket = {
  /** False once the selection this refresh was started for has changed. */
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
 * A response may only write statuses while the selection it was requested for
 * is still current: a slow response for the previous selection would otherwise
 * replace the statuses of the current one. Responses for an unchanged
 * selection are always accepted, so refreshes slower than the polling interval
 * still land instead of being superseded forever.
 *
 * `getSelection` must return a new value whenever the selection changes; it is
 * compared by identity.
 */
export function createRefreshTracker<T>(getSelection: () => T): RefreshTracker {
  let inFlight = 0;

  return {
    isRefreshing: () => inFlight > 0,
    begin: () => {
      const selection = getSelection();
      let finished = false;
      inFlight += 1;

      return {
        isCurrent: () => getSelection() === selection,
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
