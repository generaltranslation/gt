import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/diagnostics';
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
    if (!project) throw new Error(noProjectIdError(settings.dashboardUrl));
    const { orgId } = await project.get();
    const { summary, results } = await account.org(orgId).upsertAssets(fonts);
    if (summary.succeeded > 0) {
      logger.success(`Synced ${summary.succeeded} font(s)`);
    }
    for (const result of results) {
      if (result.status === 'failed') {
        logger.warn(fontNotSyncedWarning(result.fileName, result.error));
        recordWarning('failed_upload', result.fileName, result.error);
      }
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const code = error instanceof ApiError ? error.code : undefined;
    const hint = describeApiError(error);
    const details = formatDiagnosticErrorDetails(error);
    logger.warn(
      code === ErrorCode.PERMISSION_MISSING
        ? fontSyncDeniedWarning(details)
        : code === ErrorCode.PLAN_FEATURE_UNAVAILABLE
          ? fontSyncWarning(
              'Font sync is not included in your plan',
              details,
              hint
            )
          : fontSyncWarning('Font sync failed', details, hint)
    );
    recordWarning('failed_upload', 'Fonts', reason);
  }
}

const projectKeyReason = 'A project API key cannot upload organization fonts';

const fontSyncWarning = (
  whatHappened: string,
  details: string | undefined,
  fix: string | undefined
) =>
  createDiagnosticMessage({
    source: 'gt',
    severity: 'Warning',
    whatHappened,
    details,
    fix,
    reassurance: 'Translation continues with fallback fonts',
  });

const fontSyncDeniedWarning = (details: string | undefined) =>
  fontSyncWarning(
    'Font sync was denied',
    details,
    'To upload fonts, use an Organization API key with the `org:assets:write` permission'
  );

const fontNotSyncedWarning = (fileName: string, error: string | undefined) =>
  createDiagnosticMessage({
    source: 'gt',
    severity: 'Warning',
    whatHappened: `Font sync failed for ${fileName}`,
    details: error,
    reassurance: 'Translation continues without this font',
  });
