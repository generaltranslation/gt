import { useCallback, useRef, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Flex,
  Stack,
  Text,
  TextInput,
  useClickOutsideEvent,
  useGlobalKeyDown,
} from '@sanity/ui';
import { Popover } from '@sanity/ui/popover';
import { ChevronDownIcon } from '@sanity/icons/ChevronDown';
import { SearchIcon } from '@sanity/icons/Search';
import { getLocaleDisplay } from '../../utils/localeDisplay';
import { isLocaleSelected, setLocaleSelected } from '../../utils/locales';
import { useTranslations } from '../TranslationsProvider';
import { LocaleCheckbox } from './LocaleCheckbox';

function matchesSearch(localeId: string, search: string): boolean {
  const { name } = getLocaleDisplay(localeId);
  return (
    localeId.toLowerCase().includes(search) ||
    name.toLowerCase().includes(search)
  );
}

/**
 * Compact locale picker for the Translations page, modeled on the dashboard's
 * multi-locale selector. Selection lives in the provider's `locales`
 * (`enabled`), which every bulk action already reads.
 */
export const LocaleDropdown = () => {
  const { locales, setLocales, excludedLocale } = useTranslations();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const targetLocales = locales.filter(
    (locale) => locale.localeId !== excludedLocale
  );
  const selectedCount = targetLocales.filter(isLocaleSelected).length;

  const normalizedSearch = search.trim().toLowerCase();
  const visibleLocales = normalizedSearch
    ? targetLocales.filter((locale) =>
        matchesSearch(locale.localeId, normalizedSearch)
      )
    : targetLocales;
  const allVisibleSelected =
    visibleLocales.length > 0 && visibleLocales.every(isLocaleSelected);

  const label =
    selectedCount === 0
      ? 'Select locales'
      : `${selectedCount} ${selectedCount === 1 ? 'locale' : 'locales'}`;

  const close = useCallback(() => setOpen(false), []);

  useClickOutsideEvent(open && close, () => [
    buttonRef.current,
    popoverRef.current,
  ]);

  useGlobalKeyDown((event) => {
    if (open && event.key === 'Escape') {
      close();
      buttonRef.current?.focus();
    }
  });

  const toggleLocale = useCallback(
    (localeId: string, shouldEnable: boolean) =>
      setLocales(setLocaleSelected(locales, localeId, shouldEnable)),
    [locales, setLocales]
  );

  // While searching, select-all applies to the matches only, so narrowing to
  // one locale and ticking it doesn't also reselect everything else.
  const setVisibleSelected = (selected: boolean) => {
    const visibleIds = new Set(visibleLocales.map((locale) => locale.localeId));
    setLocales(
      locales.map((locale) =>
        visibleIds.has(locale.localeId)
          ? { ...locale, enabled: selected }
          : locale
      )
    );
  };

  const content = (
    <Stack style={{ minWidth: 288 }}>
      <Flex
        align='center'
        gap={2}
        padding={2}
        style={{ borderBottom: '1px solid var(--card-border-color)' }}
      >
        <Box paddingLeft={1}>
          <Checkbox
            checked={allVisibleSelected}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              setVisibleSelected(event.currentTarget.checked)
            }
            aria-label='Select all visible locales'
          />
        </Box>
        <Box flex={1}>
          <TextInput
            fontSize={1}
            icon={SearchIcon}
            placeholder='Search...'
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            border={false}
            autoFocus
          />
        </Box>
      </Flex>

      <Box padding={1} style={{ maxHeight: 320, overflowY: 'auto' }}>
        {visibleLocales.length > 0 ? (
          <Stack gap={1}>
            {visibleLocales.map((locale) => (
              <LocaleCheckbox
                key={locale.localeId}
                locale={locale}
                toggle={toggleLocale}
                checked={isLocaleSelected(locale)}
                mode='bleed'
                padding={2}
              />
            ))}
          </Stack>
        ) : (
          <Box padding={3}>
            <Text size={1} muted>
              {targetLocales.length === 0 ? 'No locales' : 'No matches'}
            </Text>
          </Box>
        )}
      </Box>
    </Stack>
  );

  return (
    <Popover
      ref={popoverRef}
      content={content}
      open={open}
      placement='bottom-end'
      portal
      constrainSize
    >
      <Button
        ref={buttonRef}
        mode='ghost'
        text={label}
        iconRight={ChevronDownIcon}
        justify='space-between'
        disabled={targetLocales.length === 0}
        style={{ width: 192 }}
        onClick={() => {
          if (!open) setSearch('');
          setOpen(!open);
        }}
      />
    </Popover>
  );
};
