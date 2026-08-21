import fs from 'node:fs';
import path from 'node:path';
import { createDiagnosticMessage } from 'generaltranslation/internal';
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

function createOutputCollisionError(
  existing: GenerationTarget,
  target: GenerationTarget
): Error {
  return new Error(
    createDiagnosticMessage({
      source: 'gt',
      severity: 'Error',
      whatHappened: 'Multiple source files map to the same generated output',
      why: 'the configured file transforms produce a duplicate path',
      fix: 'Update the file transforms so every source and locale has a unique output path',
      details: [
        `Output: ${target.outputPath}`,
        `Sources: ${existing.sourcePath} (${existing.locale}), ${target.sourcePath} (${target.locale})`,
      ],
    })
  );
}

function isSameFile(left: string, right: string): boolean {
  try {
    const leftStat = fs.statSync(left);
    const rightStat = fs.statSync(right);
    return leftStat.dev === rightStat.dev && leftStat.ino === rightStat.ino;
  } catch {
    return false;
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

      const target = { locale, sourcePath, outputPath, source, output };
      const existing = outputs.get(output);
      if (existing) {
        throw createOutputCollisionError(existing, target);
      }

      outputs.set(output, target);
      plan.push(target);
    }
  }

  return plan;
}

export async function handleGenerate(settings: Settings): Promise<void> {
  const generatedFiles = new Set<string>();
  const generatedTargets: GenerationTarget[] = [];

  try {
    for (const target of createGenerationPlan(settings)) {
      const { source, output, outputPath } = target;
      await fs.promises.mkdir(path.dirname(output), { recursive: true });
      try {
        await fs.promises.copyFile(source, output, fs.constants.COPYFILE_EXCL);
        generatedFiles.add(outputPath);
        generatedTargets.push(target);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;

        const existing = generatedTargets.find((generatedTarget) =>
          isSameFile(generatedTarget.output, output)
        );
        if (existing) throw createOutputCollisionError(existing, target);
      }
    }

    if (generatedFiles.size > 0) {
      await postProcessTranslations(settings, generatedFiles, {
        restrictToIncludedFiles: true,
      });
    }
  } catch (error) {
    await Promise.all(
      [...generatedFiles].map((filePath) =>
        fs.promises.rm(path.resolve(filePath), { force: true })
      )
    );
    throw error;
  }

  if (generatedFiles.size > 0) {
    logger.step(
      `Generated ${generatedFiles.size} translation template file${generatedFiles.size === 1 ? '' : 's'}.`
    );
  }
}
