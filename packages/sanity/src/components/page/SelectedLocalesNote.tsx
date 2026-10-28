import React from 'react';
import { Text } from '@sanity/ui';
import { formatLocaleLabel } from '../../utils/localeDisplay';
import { getLocaleRestriction } from '../../utils/locales';
import { useTranslations } from '../TranslationsProvider';

/** States which locales a bulk action will touch, for its confirm dialog. */
export const SelectedLocalesNote: React.FC = () => {
  const { locales } = useTranslations();
  const restriction = getLocaleRestriction(locales);

  return (
    <Text size={1} weight='medium'>
      {restriction === null
        ? `Locales: all ${locales.length}`
        : `Locales: ${restriction.map(formatLocaleLabel).join(', ')}`}
    </Text>
  );
};
