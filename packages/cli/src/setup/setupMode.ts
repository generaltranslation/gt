import chalk from 'chalk';
import { promptSelect } from '../console/logging.js';
import { getFrameworkDisplayName } from './frameworkUtils.js';
import type { FrameworkObject } from '../types/index.js';

export type SetupMode = 'agent' | 'manual';

type DetectedFramework = FrameworkObject | { name: undefined };

export async function promptSetupMode(
  framework: DetectedFramework
): Promise<SetupMode> {
  const detectedFramework = framework.name
    ? getFrameworkDisplayName(framework)
    : 'no supported framework detected';

  const defaultValue: SetupMode =
    framework.name === 'mintlify' || framework.name === 'next-app'
      ? 'agent'
      : 'manual';

  return await promptSelect<SetupMode>({
    message: `How would you like to set up General Translation? ${chalk.dim(`(${detectedFramework})`)}`,
    options: [
      {
        value: 'agent',
        label: 'Use Locadex AI Agent',
        hint: 'Connect GitHub and configure automation in your browser',
      },
      {
        value: 'manual',
        label: 'Configure manually',
        hint: 'Choose framework, languages, and API keys step by step',
      },
    ],
    defaultValue,
  });
}
