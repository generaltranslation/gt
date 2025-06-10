import { setupTask } from '../tasks/setup.js';

export async function setupCommand(
  bypassPrompts: boolean,
  specifiedPackageManager?: string
) {
  await setupTask(bypassPrompts, specifiedPackageManager);
}
