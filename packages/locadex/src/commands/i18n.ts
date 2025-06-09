import { i18nTask } from '../tasks/i18n.js';

export async function i18nCommand(batchSize: number) {
  await i18nTask(batchSize);
}
