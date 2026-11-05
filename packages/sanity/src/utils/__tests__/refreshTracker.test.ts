import { describe, expect, test } from 'vitest';
import { createRefreshTracker } from '../refreshTracker';

function setup(initial: string[]) {
  let selection = initial;
  const tracker = createRefreshTracker(() => selection);
  return {
    tracker,
    select: (next: string[]) => {
      selection = next;
    },
  };
}

describe('createRefreshTracker', () => {
  test('accepts a response while its selection is current', () => {
    const { tracker } = setup(['en-GB', 'fr-FR']);
    const ticket = tracker.begin();

    expect(ticket.isCurrent()).toBe(true);
  });

  test('rejects a response requested for a previous selection', () => {
    const { tracker, select } = setup(['en-GB', 'fr-FR']);
    const older = tracker.begin();

    select(['en-GB']);
    const newer = tracker.begin();

    // The older request resolves last. It must not overwrite the statuses
    // fetched for the current selection.
    expect(newer.isCurrent()).toBe(true);
    expect(older.isCurrent()).toBe(false);
  });

  test('accepts overlapping responses for an unchanged selection', () => {
    // Auto-refresh polls every 10 seconds. A request slower than that overlaps
    // the next one; rejecting it would mean no response ever lands.
    const { tracker } = setup(['en-GB']);
    const first = tracker.begin();
    const second = tracker.begin();

    expect(first.isCurrent()).toBe(true);
    expect(second.isCurrent()).toBe(true);
  });

  test('treats an equal but new selection as a change', () => {
    const { tracker, select } = setup(['en-GB']);
    const ticket = tracker.begin();

    select(['en-GB']);

    expect(ticket.isCurrent()).toBe(false);
  });

  test('stays refreshing until every overlapping request finishes', () => {
    const { tracker } = setup(['en-GB']);
    const first = tracker.begin();
    const second = tracker.begin();

    expect(tracker.isRefreshing()).toBe(true);
    expect(first.finish()).toBe(true);
    expect(tracker.isRefreshing()).toBe(true);
    expect(second.finish()).toBe(false);
    expect(tracker.isRefreshing()).toBe(false);
  });

  test('counts a failed request as finished', () => {
    const { tracker } = setup(['en-GB']);

    const run = async () => {
      const ticket = tracker.begin();
      try {
        throw new Error('status request failed');
      } finally {
        ticket.finish();
      }
    };

    return expect(run())
      .rejects.toThrow('status request failed')
      .then(() => expect(tracker.isRefreshing()).toBe(false));
  });

  test('ignores a repeated finish', () => {
    const { tracker } = setup(['en-GB']);
    const first = tracker.begin();
    tracker.begin();

    first.finish();
    first.finish();

    expect(tracker.isRefreshing()).toBe(true);
  });
});
