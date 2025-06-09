import { setupTask } from '../tasks/setup.js';

export async function setupCommand(batchSize: number) {
  await setupTask(batchSize);
}
