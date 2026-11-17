import { getRuntimeEnvironment } from 'gt-i18n/internal';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { getReadonlyConditionStore } from '../condition-store/singleton-operations';
import { getI18nConfig } from '../setup/i18nConfig';

// Only a client-rendered app knows its locale and has its catalog loaded
// wherever t and m run, module level included. Server renders use the hooks
// or getters, which load the request locale first.
export const isSpa = () => getI18nConfig().getRenderStrategy() === 'SPA';

type TaskConditions = { spa: boolean; enableI18n?: boolean; locale?: string };

let task: TaskConditions | undefined;

function thisTask(): TaskConditions {
  if (!task) {
    task = { spa: isSpa() };
    // Not queueMicrotask: old browsers have none, and fake timers hold it.
    void Promise.resolve().then(() => {
      task = undefined;
    });
  }
  return task;
}

/**
 * What t and m read for every message, read once per task: a render calls
 * them once per message, and the reads cost more than rendering one. A new
 * locale, enabled flag or config is seen in the next task.
 */
export const taskConditions = {
  isSpa: (): boolean => thisTask().spa,
  // Outside an SPA, t and m render the source once the misuse is reported.
  getEnableI18n(): boolean {
    const conditions = thisTask();
    return (conditions.enableI18n ??=
      conditions.spa && getReadonlyConditionStore().getEnableI18n());
  },
  getLocale: (): string =>
    (thisTask().locale ??= getReadonlyConditionStore().getLocale()),
};

export function reportServerRenderedUse({
  name,
  fix,
  message,
}: {
  name: 't' | 'm';
  fix: string;
  message?: string;
}): void {
  const development = getRuntimeEnvironment() === 'development';
  const diagnostic = createDiagnosticMessage({
    source: '@generaltranslation/react-core',
    severity: 'Error',
    whatHappened: `${name}() is only available in client-rendered (SPA) apps`,
    fix,
    wayOut: development ? undefined : 'The source message was rendered',
    details: message === undefined ? undefined : `Message: "${message}"`,
  });
  if (development) throw new Error(diagnostic);
  console.error(diagnostic);
}
