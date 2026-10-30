import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/diagnostics';
import type { ProjectHandle } from 'generaltranslation';
import { ApiError, ErrorCode } from '@generaltranslation/api';

/** Source uploads do not update the project's default locale. */
export async function syncProjectDefaultLocale(
  project: ProjectHandle,
  sourceLocale: string
): Promise<void> {
  const { defaultLocale } = await project.get();
  if (defaultLocale === sourceLocale) return;
  try {
    await project.update({ defaultLocale: sourceLocale });
  } catch (error) {
    // A key without project:write can still upload and translate documents.
    if (
      !(error instanceof ApiError) ||
      error.code !== ErrorCode.PERMISSION_MISSING
    )
      throw error;
    console.warn(
      createDiagnosticMessage({
        source: 'gt-sanity',
        severity: 'Warning',
        whatHappened: `The project's default locale was not updated to ${sourceLocale}`,
        why: 'the API key lacks the project settings permission project:write',
        reassurance: 'Your documents were uploaded',
        fix: 'Update the default locale in the General Translation dashboard, or use a key with project:write',
        details: formatDiagnosticErrorDetails(error),
      })
    );
  }
}
