import fs from 'node:fs';
import path from 'node:path';
import { createDiagnosticMessage } from 'generaltranslation/internal';
import { logger } from '../../console/logger.js';
import { createFileMapping } from '../../formats/files/fileMapping.js';
import { createSourceTemplate } from '../../formats/files/mergeWithSource.js';
import { SUPPORTED_FILE_EXTENSIONS } from '../../formats/files/supportedFiles.js';
import { hasNonIdentityFileFormatTransformForType } from '../../formats/files/transformFormat.js';
import type { Settings } from '../../types/index.js';
import { postProcessTranslations } from './translate.js';

type GenerationTarget = {
  locale: string;
  sourcePath: string;
  outputPath: string;
  source: string;
  output: string;
  changesFormat: boolean;
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
      fix: 'Update the file transforms so every source and locale has a unique output path',
      details: [
        `Output: ${target.outputPath}`,
        `Sources: ${existing.sourcePath} (${existing.locale}), ${target.sourcePath} (${target.locale})`,
      ],
    })
  );
}

function createGenerationPlan(settings: Settings): GenerationTarget[] {
  const formatChangingSources = new Set<string>();
  for (const fileType of SUPPORTED_FILE_EXTENSIONS) {
    if (!hasNonIdentityFileFormatTransformForType(settings, fileType)) continue;
    for (const sourcePath of settings.files.resolvedPaths[fileType] || []) {
      formatChangingSources.add(path.resolve(sourcePath));
    }
  }

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

  for (const [locale, localeMapping] of Object.entries(fileMapping)) {
    for (const [sourcePath, outputPath] of Object.entries(localeMapping)) {
      const source = path.resolve(sourcePath);
      const output = path.resolve(outputPath);
      if (source === output || !fs.existsSync(source)) continue;

      const target = {
        locale,
        sourcePath,
        outputPath,
        source,
        output,
        changesFormat: formatChangingSources.has(source),
      };
      const existing = outputs.get(output);
      if (existing) throw createOutputCollisionError(existing, target);
      outputs.set(output, target);
    }
  }

  return [...outputs.values()];
}

export async function handleGenerate(settings: Settings): Promise<void> {
  const generatedFiles = new Set<string>();

  for (const target of createGenerationPlan(settings)) {
    if (fs.existsSync(target.output)) continue;
    if (target.changesFormat) {
      throw new Error(
        createDiagnosticMessage({
          source: 'gt',
          severity: 'Error',
          whatHappened:
            'gt generate cannot create templates that change the source file format',
          fix: 'Remove transformationFormat or use gt translate to create the converted files',
        })
      );
    }

    const content =
      createSourceTemplate(target.locale, target.source, settings) ??
      (await fs.promises.readFile(target.source));
    await fs.promises.mkdir(path.dirname(target.output), { recursive: true });
    try {
      await fs.promises.writeFile(target.output, content, { flag: 'wx' });
      generatedFiles.add(target.outputPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
  }

  if (generatedFiles.size === 0) return;

  await postProcessTranslations(settings, generatedFiles, {
    restrictToIncludedFiles: true,
  });
  logger.step(
    `Generated ${generatedFiles.size} translation template file${generatedFiles.size === 1 ? '' : 's'}.`
  );
}
