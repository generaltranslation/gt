import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { logger } from '../console/logger.js';
import type { Settings } from '../types/index.js';

const PARAGLIDE_COMPILER = '@generaltranslation/paraglide-js/compiler';

type ParaglideCompiler = {
  collectContext(options: {
    root: string;
    logger: {
      warn(message: string): void;
      info(message: string): void;
    };
  }): Promise<void>;
};

/**
 * Writes the Paraglide metadata files that file collection reads, so call it
 * first. Failures only warn.
 */
export async function collectParaglideContext(
  settings: Settings,
  projectRoot: string = process.cwd()
): Promise<void> {
  if (!settings.files?.parsingFlags?.json?.includeSourceCodeContext) return;

  const compilerPath = resolveParaglideCompiler(projectRoot);
  if (!compilerPath) return;

  // Deferred so they do not break the spinner line
  const warnings: string[] = [];
  const spinner = logger.createSpinner('dots');
  spinner.start('Collecting source code context for Paraglide messages...');

  try {
    const { collectContext }: ParaglideCompiler = await import(
      pathToFileURL(compilerPath).href
    );
    await collectContext({
      root: projectRoot,
      logger: {
        warn: (message) => warnings.push(message),
        info: () => {},
      },
    });
    spinner.stop('Collected source code context for Paraglide messages');
  } catch (error) {
    spinner.stop('Source code context for Paraglide messages was skipped');
    warnings.push(
      `Source code context for Paraglide messages could not be collected: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  for (const warning of warnings) logger.warn(warning);
}

function resolveParaglideCompiler(projectRoot: string): string | undefined {
  try {
    return createRequire(path.join(projectRoot, 'package.json')).resolve(
      PARAGLIDE_COMPILER
    );
  } catch {
    return undefined;
  }
}
