import type { Adapter } from '../types';

import { getLocales } from './getLocales';
import { getTranslationTask } from './getTranslationTask';
import { getTranslation } from './getTranslation';
import { createTask } from './createTask';

export const GTAdapter: Adapter = {
  getLocales,
  getTranslationTask,
  createTask,
  getTranslation,
};
