import { describeTable, formatLabel } from 'fake-lib';

export function showPlain() {
  document.body.append(formatLabel('plain page without translations'));
  document.body.append(describeTable());
}
