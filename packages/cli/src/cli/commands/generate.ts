import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/internal';
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
      why: 'the configured file transforms produce a duplicate path',
      fix: 'Update the file transforms so every source and locale has a unique output path',
      details: [
        `Output: ${target.outputPath}`,
        `Sources: ${existing.sourcePath} (${existing.locale}), ${target.sourcePath} (${target.locale})`,
      ],
    })
  );
}

function createInvalidOutputError(target: GenerationTarget): Error {
  return new Error(
    createDiagnosticMessage({
      source: 'gt',
      severity: 'Error',
      whatHappened: 'A generated output path is not a regular file',
      fix: 'Remove or rename the existing path before running gt generate again',
      details: `Output: ${target.outputPath}`,
    })
  );
}

function createUnsupportedFormatTransformError(): Error {
  return new Error(
    createDiagnosticMessage({
      source: 'gt',
      severity: 'Error',
      whatHappened:
        'gt generate cannot create templates that change the source file format',
      fix: 'Remove transformationFormat or use gt translate to create the converted files',
    })
  );
}

function createChangedOutputError(target: GenerationTarget): Error {
  return new Error(
    createDiagnosticMessage({
      source: 'gt',
      severity: 'Error',
      whatHappened: 'A generated output changed while it was being created',
      fix: 'Stop the process changing the output and run gt generate again',
      details: `Output: ${target.outputPath}`,
    })
  );
}

async function getFileIdentity(filePath: string): Promise<string | null> {
  try {
    const stat = await fs.promises.stat(filePath);
    return stat.isFile() ? `${stat.dev}:${stat.ino}` : null;
  } catch {
    return null;
  }
}

async function rollbackGeneratedFiles(
  generatedFiles: Set<string>
): Promise<void> {
  const files = [...generatedFiles];
  const results = await Promise.allSettled(
    files.map(async (filePath) => {
      const file = path.resolve(filePath);
      const recoveryFile = path.join(
        path.dirname(file),
        `.gt-rollback-${randomUUID()}`
      );
      try {
        await fs.promises.rename(file, recoveryFile);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
        throw error;
      }
      return `${filePath}: preserved at ${recoveryFile}`;
    })
  );
  const failures = results.flatMap((result, index) =>
    result.status === 'rejected'
      ? [
          `${files[index]}: ${formatDiagnosticErrorDetails(result.reason) ?? 'Unknown error'}`,
        ]
      : result.value
        ? [result.value]
        : []
  );

  if (failures.length > 0) {
    logger.warn(
      createDiagnosticMessage({
        source: 'gt',
        severity: 'Warning',
        whatHappened:
          'Generated template files were preserved after generation failed',
        fix: 'Review or remove the listed recovery files after retrying gt generate',
        details: failures,
      })
    );
  }
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
  const plan: GenerationTarget[] = [];

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
      if (existing) {
        throw createOutputCollisionError(existing, target);
      }

      outputs.set(output, target);
      plan.push(target);
    }
  }

  return plan;
}

async function createTargetFile(
  target: GenerationTarget,
  settings: Settings,
  generatedFiles: Set<string>
): Promise<string> {
  const { source, output, outputPath } = target;
  await fs.promises.mkdir(path.dirname(output), { recursive: true });

  let fileHandle: fs.promises.FileHandle;
  try {
    fileHandle = await fs.promises.open(output, 'wx');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    const identity = await getFileIdentity(output);
    if (!identity) throw createInvalidOutputError(target);
    return identity;
  }

  let identity: string;
  try {
    const stat = await fileHandle.stat();
    identity = `${stat.dev}:${stat.ino}`;
    generatedFiles.add(outputPath);

    if (target.changesFormat) {
      throw createUnsupportedFormatTransformError();
    }
    const sourceTemplate = createSourceTemplate(
      target.locale,
      source,
      settings
    );
    const content = sourceTemplate ?? (await fs.promises.readFile(source));
    await fileHandle.writeFile(content);
  } finally {
    await fileHandle.close();
  }

  if ((await getFileIdentity(output)) !== identity) {
    throw createChangedOutputError(target);
  }
  return identity;
}

export async function handleGenerate(settings: Settings): Promise<void> {
  const generatedFiles = new Set<string>();
  const processedOutputs = new Map<string, GenerationTarget>();

  try {
    for (const target of createGenerationPlan(settings)) {
      const identity = await createTargetFile(target, settings, generatedFiles);
      const existing = processedOutputs.get(identity);
      if (existing) throw createOutputCollisionError(existing, target);
      processedOutputs.set(identity, target);
    }

    if (generatedFiles.size > 0) {
      await postProcessTranslations(settings, generatedFiles, {
        restrictToIncludedFiles: true,
      });
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
