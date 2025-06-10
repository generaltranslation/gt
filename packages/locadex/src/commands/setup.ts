import { setupTask } from '../tasks/setup.js';

export async function setupCommand() {
  await setupTask();
}
