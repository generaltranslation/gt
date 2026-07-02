import path from 'node:path';
import chalk from 'chalk';
import type { FileToUpload } from 'generaltranslation/types';
import { logger } from '../console/logger.js';
import { Settings } from '../types/index.js';

/**
 * Warns when an upload contains review-gated content but the project
 * auto-approves new translations, pointing the user at the dashboard project
 * settings page. The CLI cannot change the auto-approve setting itself —
 * review setup happens in the dashboard.
 *
 * `autoApprove` comes from the enqueue API response when available:
 * - false: manual review is already the project workflow — no warning
 * - true: requiresReview config has no gating effect — warn
 * - undefined (API does not return project settings yet): warn with
 *   conditional wording, since auto-approve is the platform default
 */
export function warnManualReviewSetup(
  settings: Settings,
  files: FileToUpload[],
  autoApprove?: boolean
): void {
  if (autoApprove === false) return;

  const requiresReviewPaths = settings.files?.requiresReviewPaths;

  const hasReviewGatedFile = files.some((file) => {
    if (file.fileFormat === 'GTJSON') {
      return Object.values(file.formatMetadata ?? {}).some(
        (metadata) =>
          (metadata as { requiresReview?: boolean })?.requiresReview === true
      );
    }
    return requiresReviewPaths?.has(path.resolve(process.cwd(), file.fileName));
  });
  if (!hasReviewGatedFile) return;

  const settingsUrl = settings.projectId
    ? `${settings.dashboardUrl}/project/${settings.projectId}/settings`
    : settings.dashboardUrl;
  const autoApproveClause =
    autoApprove === true
      ? 'but this project approves new translations automatically.'
      : 'but new translations are approved automatically unless auto-approval is turned off for this project.';
  // "Auto approve translations" matches the dashboard setting title exactly.
  const message =
    `Some of your content requires review (requiresReview), ${autoApproveClause} ` +
    `To review translations before they are used, disable "Auto approve translations" in your project settings:`;
  logger.warn(
    chalk.yellow(
      [...wrapWords(message, 70), chalk.cyan(settingsUrl)].join('\n')
    )
  );
}

/**
 * Greedy word wrap so warning lines render at a consistent width instead of
 * one terminal-width line followed by stubby fragments.
 */
function wrapWords(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line && line.length + 1 + word.length > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}
