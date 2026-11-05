import { AsyncLocalConditionStore } from '../../condition-store/AsyncLocalConditionStore';
import type { InitializeGTParams } from '../../types/InitializeGTParams';
import { resolveRequestLocale } from '../functions/resolveRequestLocale';

/**
 * The server request condition store with locale twins: it also resolves the
 * locale of any request, which `createLocaleTwinAssets()` needs to choose the
 * twins before the request's conditions are read.
 */
export class LocaleTwinConditionStore extends AsyncLocalConditionStore {
  constructor(private readonly localeConfig: InitializeGTParams) {
    super(localeConfig);
  }

  /**
   * The locale of a request, resolved like its conditions (the resolution is
   * deterministic) but without writing the locale cookie.
   */
  resolveLocale(request: Request): string {
    return resolveRequestLocale(request, this.localeConfig);
  }
}
