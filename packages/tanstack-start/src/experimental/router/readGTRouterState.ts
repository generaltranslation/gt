import { getI18nConfig } from '@generaltranslation/react-core/pure';
import { getReactI18nCache } from 'gt-react/experimental';
import { getRuntimeEnvironment } from 'gt-i18n/internal';
import { isLocaleTwinsEnabled } from 'gt-i18n/internal/experimental';
import { readGTRouterState as readRegularGTRouterState } from '../../router/createGTRouterWrap';
import type { GTRouterState } from '../../router/types';

type GTConditionSource = Parameters<typeof readRegularGTRouterState>[0];

/**
 * The router's GT state with locale twins. The server still loads the whole
 * request locale to render it, but in production builds the client renders
 * from its twins, so the page carries no translations snapshot. `vite dev`
 * serves no twins and hydrates from the snapshot. Dictionary entries are
 * never twinned: an app with a (source) dictionary keeps the snapshot.
 */
export async function readGTRouterState(
  conditionStore: GTConditionSource
): Promise<GTRouterState> {
  const twinsCarryTranslations =
    isLocaleTwinsEnabled() && getRuntimeEnvironment() === 'production';
  const [state, sourceDictionary] = await Promise.all([
    readRegularGTRouterState(conditionStore),
    twinsCarryTranslations
      ? getReactI18nCache().loadDictionary(getI18nConfig().getDefaultLocale())
      : {},
  ]);
  return twinsCarryTranslations && Object.keys(sourceDictionary).length === 0
    ? { ...state, translations: {} }
    : state;
}
