import { logger } from '../../console/logger.js';
import { Settings } from '../../types/index.js';
import { api } from '../../utils/api.js';
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
  try {
    const result = await api.uploadFonts(fonts);
    logger.success(`Synced ${result.count} font(s)`);
  } catch (error) {
    logger.warn(
      `Font sync failed; continuing without provisioned fonts: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
