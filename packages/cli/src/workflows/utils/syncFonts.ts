import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { ApiError, ErrorCode } from '@generaltranslation/api';
import { logger } from '../../console/logger.js';
import { recordWarning } from '../../state/translateWarnings.js';
import { Settings } from '../../types/index.js';
import { createClients } from '../../utils/api.js';
import { describeApiError, noProjectIdError } from '../../console/index.js';
import { collectFonts } from '../../formats/files/collectFonts.js';

/**
 * Syncs configured project fonts to the API so they're available when
 * translation jobs run (e.g. Lottie layout refinement). Fonts are
 * locale-invariant and the upload is idempotent server-side, so calling this
 * from every workflow that triggers jobs is safe. A failure is non-fatal —
 * translation still proceeds with fallback fonts.
 */
export async function syncFonts(settings: Settings): Promise<void> {
  const fonts = await collectFonts(settings);
  if (fonts.length === 0) return;
  const { project, account } = createClients(settings);
  // Without an account-scoped client the credentials are a project key, which the organization assets endpoint rejects.
  if (!account) {
    logger.warn(fontSyncDeniedWarning(projectKeyReason));
    recordWarning('failed_upload', 'Fonts', projectKeyReason);
    return;
  }
  try {
    if (!project) throw new Error(noProjectIdError);
    const { orgId } = await project.get();
    const { summary, results } = await account.org(orgId).upsertAssets(fonts);
    if (summary.succeeded > 0) {
      logger.success(`Synced ${summary.succeeded} font(s)`);
    }
    for (const result of results) {
      if (result.status === 'failed') {
        logger.warn(
          `Font sync failed for ${result.fileName}; continuing without it: ${result.error}`
        );
        recordWarning('failed_upload', result.fileName, result.error);
      }
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const code = error instanceof ApiError ? error.code : undefined;
    const hint = describeApiError(error);
    logger.warn(
      code === ErrorCode.PERMISSION_MISSING
        ? fontSyncDeniedWarning(reason)
        : code === ErrorCode.PLAN_FEATURE_UNAVAILABLE
          ? fontSyncUnavailableWarning(reason, hint)
          : `Font sync failed; continuing without provisioned fonts: ${reason}${hint ? ` ${hint}` : ''}`
    );
    recordWarning('failed_upload', 'Fonts', reason);
  }
}

const projectKeyReason = 'A project API key cannot upload organization fonts';

const fontSyncDeniedWarning = (reason: string) =>
  createDiagnosticMessage({
    source: 'gt',
    severity: 'Warning',
    whatHappened: 'Font sync was denied',
    details: reason,
    fix: 'To upload fonts, use an Organization API key with the `org:assets:write` permission',
    reassurance: 'Translation continues with fallback fonts',
  });

const fontSyncUnavailableWarning = (reason: string, fix?: string) =>
  createDiagnosticMessage({
    source: 'gt',
    severity: 'Warning',
    whatHappened: 'Font sync is not included in your plan',
    details: reason,
    fix,
    reassurance: 'Translation continues with fallback fonts',
  });
