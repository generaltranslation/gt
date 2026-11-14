import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { logger } from '../console/logger.js';

const PARAGLIDE_COMPILER = '@generaltranslation/paraglide-js/compiler';

type ParaglideCompiler = {
  collectContext(options: {
    root: string;
    cache: boolean;
    logger: {
      warn(message: string): void;
      info(message: string): void;
    };
  }): Promise<void>;
};

/**
 * Writes the Paraglide metadata files that file collection reads, so call it
 * first. Failures only warn. `cache` keeps what a run found in gt-lock.json.
 */
export async function collectParaglideContext({
  projectRoot = process.cwd(),
  cache = false,
}: { projectRoot?: string; cache?: boolean } = {}): Promise<void> {
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
      cache,
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
