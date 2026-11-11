import path from 'node:path';
import type { ContextCollector } from '../collector/collector.js';

/**
 * Runs collector tasks one at a time, and writes the output after each task
 * that does not return `false`. Errors are reported, not thrown, so that a
 * failed analysis never fails the build.
 */
export function taskQueue(onError: (error: Error) => void) {
  let queue = Promise.resolve();
  return (
    collector: ContextCollector,
    task: (collector: ContextCollector) => Promise<unknown>
  ) => {
    queue = queue
      .then(async () => {
        if ((await task(collector)) !== false) await collector.write();
      })
      .catch((error: Error) => onError(error));
    return queue;
  };
}

/** `/src/App.vue?vue&type=script` → `/src/App.vue`; virtual modules → undefined */
export function fileOfId(id: string | undefined): string | undefined {
  const file = id?.split('?', 1)[0];
  if (!file || file.startsWith('\0') || !path.isAbsolute(file))
    return undefined;
  return path.normalize(file);
}
