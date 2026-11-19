import { t } from 'gt-react';

// Two routes import this module, so it gets a chunk of its own, with too few
// messages for a translations file of its own: they are in the file of each
// route. It reads them as it is evaluated, which is when a route is imported.
((window.__evaluated ??= {}).statuses ??= []).push(performance.now());

export const statusHeading = t`Order status`;
export const STATUS_LABELS = [t`Pending`, t`Shipped`, t`Delivered`];

// Messages with a value. The first is read as this module is evaluated;
// nothing imports the second, so the bundler drops it, and its message with
// it: no translations file may hold it.
export const statusOwner = t`Managed by ${{ name: 'Ada' }}`;
export const archivedBy = (name: string) => t`Archived by ${{ name }}`;
