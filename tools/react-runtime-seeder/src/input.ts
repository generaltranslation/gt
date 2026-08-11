import { createSeederError } from './diagnostics';

export async function resolveCaptureInput(
  values: { file?: string; code?: string; stdin?: boolean },
  readStdin: () => Promise<string>
): Promise<{ file?: string; code?: string }> {
  const inputCount = [
    values.file != null,
    values.code != null,
    values.stdin === true,
  ].filter(Boolean).length;
  if (inputCount !== 1) {
    throw createSeederError({
      whatHappened: 'Exactly one input mode is required',
      fix: 'Pass one of --file, --code, or --stdin.',
    });
  }
  return {
    file: values.file,
    code: values.stdin ? await readStdin() : values.code,
  };
}
