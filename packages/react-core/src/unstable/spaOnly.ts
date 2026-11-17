import { getRuntimeEnvironment } from 'gt-i18n/internal';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { getI18nConfig } from '../setup/i18nConfig';

// Only a client-rendered app knows its locale and has its catalog loaded
// wherever t and m run, module level included. Server renders use the hooks
// or getters, which load the request locale first.
export const isSpa = () => getI18nConfig().getRenderStrategy() === 'SPA';

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
    whatHappened: `${name} from /unstable is only available in client-rendered (SPA) apps`,
    fix,
    wayOut: development ? undefined : 'The source message was rendered',
    details: message === undefined ? undefined : `Message: "${message}"`,
  });
  if (development) throw new Error(diagnostic);
  console.error(diagnostic);
}
