import {
  ClientGTProvider,
  type ClientGTProviderProps,
  type ConditionStorage,
} from '@generaltranslation/react-core/components';
import { getI18nConfig } from '@generaltranslation/react-core/pure';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { readNativeLocales } from '../utils/getLocale';
import { nativeStoreGet, nativeStoreSet } from '../utils/nativeStore';

export type GTProviderProps = ClientGTProviderProps;

/**
 * Provides GT to the components below it. It loads each locale's translations
 * itself and changes locale in place, as gt-react's provider does without
 * `translations`: both are react-core's ClientGTProvider.
 */
export function GTProvider({ fallback, ...props }: GTProviderProps) {
  return (
    <ClientGTProvider
      {...props}
      fallback={fallback ?? <DefaultLoadingFallback />}
      storage={nativeStorage}
    />
  );
}

/** What the user chose is kept in native storage, under the names the web's cookies have. */
const nativeStorage: ConditionStorage = {
  read() {
    const i18nConfig = getI18nConfig();
    return {
      locale: readNativeLocales(i18nConfig.getLocaleCookieName()),
      region: nativeStoreGet(i18nConfig.getRegionCookieName()) || undefined,
      // Read as the web reads its cookie: on unless the stored value says otherwise.
      enableI18n:
        (nativeStoreGet(i18nConfig.getEnableI18nCookieName()) ?? 'true') ===
        'true',
    };
  },
  save(conditions) {
    const i18nConfig = getI18nConfig();
    if (conditions.locale !== undefined) {
      nativeStoreSet(i18nConfig.getLocaleCookieName(), conditions.locale);
    }
    if ('region' in conditions) {
      nativeStoreSet(i18nConfig.getRegionCookieName(), conditions.region ?? '');
    }
    if (conditions.enableI18n !== undefined) {
      nativeStoreSet(
        i18nConfig.getEnableI18nCookieName(),
        conditions.enableI18n ? 'true' : 'false'
      );
    }
  },
};

function DefaultLoadingFallback() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
