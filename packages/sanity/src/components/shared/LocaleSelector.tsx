import { useCallback } from 'react';
import { Button, Flex, Grid, Stack, Text } from '@sanity/ui';
import { pluginConfig } from '../../adapter/core';
import {
  isLocaleSelected,
  setLocaleSelected,
  toggleAllLocales,
} from '../../utils/locales';
import { useTranslations } from '../TranslationsProvider';
import { LocaleCheckbox } from './LocaleCheckbox';

/**
 * Picks the target locales the surrounding view acts on. Selection lives in
 * the provider's `locales` (`enabled`), which every bulk action already reads.
 */
export const LocaleSelector = () => {
  const { locales, setLocales } = useTranslations();
  const sourceLocale = pluginConfig.getSourceLocale();
  const targetLocales = locales.filter(
    (locale) => locale.localeId !== sourceLocale
  );
  const selectedCount = targetLocales.filter(isLocaleSelected).length;

  const toggleLocale = useCallback(
    (localeId: string, shouldEnable: boolean) =>
      setLocales(setLocaleSelected(locales, localeId, shouldEnable)),
    [locales, setLocales]
  );

  return (
    <Stack gap={3}>
      <Flex align='center' justify='space-between'>
        <Text weight='semibold' size={1}>
          {selectedCount === 1 ? 'Select locale' : 'Select locales'}
        </Text>
        <Button
          fontSize={1}
          padding={2}
          mode='ghost'
          text='Toggle All'
          onClick={() => setLocales(toggleAllLocales(locales, sourceLocale))}
        />
      </Flex>

      <Grid gridTemplateColumns={[1, 1, 2, 3]} gap={1}>
        {targetLocales.map((locale) => (
          <LocaleCheckbox
            key={locale.localeId}
            locale={locale}
            toggle={toggleLocale}
            checked={isLocaleSelected(locale)}
          />
        ))}
      </Grid>
    </Stack>
  );
};
