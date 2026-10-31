import React from 'react';
import { Text } from '@sanity/ui';
import { formatLocaleLabel } from '../../utils/localeDisplay';
import { getSelectedLocaleIds } from '../../utils/locales';
import { useTranslations } from '../TranslationsProvider';

/** States which locales a bulk action will touch, for its confirm dialog. */
export const SelectedLocalesNote: React.FC = () => {
  const { locales } = useTranslations();
  const selectedLocaleIds = getSelectedLocaleIds(locales);

  return (
    <Text size={1} weight='medium'>
      {selectedLocaleIds.length === locales.length
        ? `Locales: all ${locales.length}`
        : `Locales: ${selectedLocaleIds.map(formatLocaleLabel).join(', ')}`}
    </Text>
  );
};
