import { withLocaleTwinReload } from '@generaltranslation/react-core/internal/experimental';
import {
  createOrUpdateBrowserConditionStore as createOrUpdateRegularBrowserConditionStore,
  type CreateBrowserConditionStoreParams,
} from '../../condition-store/createBrowserConditionStore';

/**
 * `createOrUpdateBrowserConditionStore()` with locale twins: a locale switch
 * on a twin client loads a new document (a custom `_reload` that does not
 * navigate is followed by a document reload).
 */
export function createOrUpdateBrowserConditionStore(
  config: CreateBrowserConditionStoreParams
) {
  return createOrUpdateRegularBrowserConditionStore({
    ...config,
    _reload: withLocaleTwinReload(config._reload),
  });
}
