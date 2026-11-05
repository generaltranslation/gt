// Like a framework's client entry: library code that imports the app.
import { routes } from '@app/routes';
import { formatLabel } from 'fake-lib';

const FAKE_FRAMEWORK_MARKER = 'fake-framework imports app code';

export function startApp() {
  return formatLabel(`${FAKE_FRAMEWORK_MARKER} ${routes.join(',')}`);
}
