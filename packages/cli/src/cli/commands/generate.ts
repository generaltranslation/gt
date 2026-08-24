import fs from 'node:fs';
import path from 'node:path';
import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/internal';
import { logger } from '../../console/logger.js';
import { createFileMapping } from '../../formats/files/fileMapping.js';
import type { Settings } from '../../types/index.js';
import { postProcessTranslations } from './translate.js';

type GenerationTarget = {
  locale: string;
  sourcePath: string;
  outputPath: string;
  source: string;
  output: string;
};

async function rollbackGeneratedFiles(filePaths: Set<string>): Promise<void> {
  const files = [...filePaths];
  const results = await Promise.allSettled(
    files.map((filePath) =>
      fs.promises.rm(path.resolve(filePath), { force: true })
    )
  );
  const failures = results.flatMap((result, index) =>
    result.status === 'rejected'
      ? [
          `${files[index]}: ${formatDiagnosticErrorDetails(result.reason) ?? 'Unknown error'}`,
        ]
      : []
  );

  if (failures.length > 0) {
    logger.warn(
      createDiagnosticMessage({
        source: 'gt',
        severity: 'Warning',
        whatHappened:
          'Some generated template files could not be removed after generation failed',
        fix: 'Remove the listed files before running gt generate again',
        details: failures,
      })
    );
  }
}

function createGenerationPlan(settings: Settings): GenerationTarget[] {
  const { resolvedPaths, placeholderPaths, transformPaths, transformFormats } =
    settings.files;
  const fileMapping = createFileMapping(
    resolvedPaths,
    placeholderPaths,
    transformPaths,
    transformFormats,
    settings.locales,
    settings.defaultLocale
  );
  const outputs = new Map<string, GenerationTarget>();
  const plan: GenerationTarget[] = [];

  for (const [locale, localeMapping] of Object.entries(fileMapping)) {
    for (const [sourcePath, outputPath] of Object.entries(localeMapping)) {
      const source = path.resolve(sourcePath);
      const output = path.resolve(outputPath);
      if (source === output || !fs.existsSync(source)) continue;

      const existing = outputs.get(output);
      if (existing) {
        throw new Error(
          createDiagnosticMessage({
            source: 'gt',
            severity: 'Error',
            whatHappened:
              'Multiple source files map to the same generated output',
            why: 'the configured file transforms produce a duplicate path',
            fix: 'Update the file transforms so every source and locale has a unique output path',
            details: [
              `Output: ${outputPath}`,
              `Sources: ${existing.sourcePath} (${existing.locale}), ${sourcePath} (${locale})`,
            ],
          })
        );
      }

      const target = { locale, sourcePath, outputPath, source, output };
      outputs.set(output, target);
      plan.push(target);
    }
  }

  return plan;
}

export async function handleGenerate(settings: Settings): Promise<void> {
  const generatedFiles = new Set<string>();

  try {
    for (const { source, output, outputPath } of createGenerationPlan(
      settings
    )) {
      await fs.promises.mkdir(path.dirname(output), { recursive: true });
      try {
        await fs.promises.copyFile(source, output, fs.constants.COPYFILE_EXCL);
        generatedFiles.add(outputPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      }
    }

    if (generatedFiles.size > 0) {
      await postProcessTranslations(settings, generatedFiles);
    }
  } catch (error) {
    await rollbackGeneratedFiles(generatedFiles);
    throw error;
  }

  if (generatedFiles.size > 0) {
    logger.step(
      `Generated ${generatedFiles.size} translation template file${generatedFiles.size === 1 ? '' : 's'}.`
    );
  }
}
