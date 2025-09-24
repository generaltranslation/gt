// adapted from https://github.com/sanity-io/sanity-translations-tab. See LICENSE.md for more details.

import React, {
  useState,
  useCallback,
  useEffect,
} from 'react';
import styled from 'styled-components';
import {
  Button,
  Box,
  Flex,
  Grid,
  Stack,
  Switch,
  Text,
  useToast,
} from '@sanity/ui';

import { TranslationLocale } from '../../types';
import { useTranslations } from '../TranslationsProvider';

type Props = {
  locales: TranslationLocale[];
};

type LocaleCheckboxProps = {
  locale: TranslationLocale;
  toggle: (locale: string, checked: boolean) => void;
  checked: boolean;
};

const WrapText = styled(Box)`
  white-space: normal;
`;

const LocaleCheckbox = ({ locale, toggle, checked }: LocaleCheckboxProps) => {
  const onClick = useCallback(
    () => toggle(locale.localeId, !checked),
    [locale, toggle, checked]
  );

  return (
    <Button
      mode='ghost'
      onClick={onClick}
      disabled={locale.enabled === false}
      style={{ cursor: `pointer` }}
      radius={2}
    >
      <Flex align='center' gap={3}>
        <Switch
          style={{ pointerEvents: `none` }}
          disabled={locale.enabled === false}
          onChange={onClick}
          checked={checked}
        />
        <WrapText>
          <Text size={1} weight='semibold'>
            {locale.description}
          </Text>
        </WrapText>
      </Flex>
    </Button>
  );
};

export const NewTask = ({ locales }: Props) => {
  const possibleLocales = locales.filter((locale) => locale.enabled !== false);
  const [selectedLocales, setSelectedLocales] = useState<string[]>(
    locales
      .filter((locale) => locale.enabled !== false)
      .map((locale) => locale.localeId)
  );

  const { isBusy, handleCreateTask, handleRefreshTask } = useTranslations();
  const toast = useToast();

  useEffect(() => {
    setSelectedLocales(
      locales
        .filter((locale) => locale.enabled !== false)
        .map((locale) => locale.localeId)
    );
  }, [locales]);

  const toggleLocale = useCallback(
    (locale: string, selected: boolean) => {
      if (!selected) {
        setSelectedLocales(selectedLocales.filter((l) => l !== locale));
      } else if (!selectedLocales.includes(locale)) {
        setSelectedLocales([...selectedLocales, locale]);
      }
    },
    [selectedLocales, setSelectedLocales]
  );

  const createTask = useCallback(async () => {
    if (!handleCreateTask) {
      toast.push({
        title: 'Unable to create task: missing functionality',
        status: 'error',
        closable: true,
      });
      return;
    }

    try {
      await handleCreateTask(selectedLocales);

      toast.push({
        title: 'Job successfully created',
        status: 'success',
        closable: true,
      });

      // Reset form fields
      setSelectedLocales([]);

      // Refresh task data
      if (handleRefreshTask) {
        await handleRefreshTask();
      }
    } catch (err) {
      let errorMsg;
      if (err instanceof Error) {
        errorMsg = err.message;
      } else {
        errorMsg = err ? String(err) : null;
      }

      toast.push({
        title: `Error creating translation job`,
        description: errorMsg,
        status: 'error',
        closable: true,
      });
    }
  }, [handleCreateTask, selectedLocales, toast, handleRefreshTask]);

  const onClick = useCallback(() => {
    setSelectedLocales(
      possibleLocales.length === selectedLocales.length
        ? // Disable all
          []
        : // Enable all
          locales
            .filter((locale) => locale.enabled !== false)
            .map((locale) => locale.localeId)
    );
  }, [possibleLocales, selectedLocales, setSelectedLocales, locales]);

  const onToggle = useCallback(
    (locale: string, checked: boolean) => {
      toggleLocale(locale, checked);
    },
    [toggleLocale]
  );

  return (
    <Stack paddingTop={4} space={4}>
      <Text as='h2' weight='semibold' size={2}>
        Generate New Translations
      </Text>
      <Stack space={3}>
        <Flex align='center' justify='space-between'>
          <Text weight='semibold' size={1}>
            {possibleLocales.length === 1 ? `Select locale` : `Select locales`}
          </Text>

          <Button
            fontSize={1}
            padding={2}
            text='Toggle All'
            onClick={onClick}
          />
        </Flex>

        <Grid columns={[1, 1, 2, 3]} gap={1}>
          {(locales || []).map((l) => (
            <LocaleCheckbox
              key={l.localeId}
              locale={l}
              toggle={onToggle}
              checked={selectedLocales.includes(l.localeId)}
            />
          ))}
        </Grid>
      </Stack>

      <Button
        onClick={createTask}
        disabled={isBusy || !selectedLocales.length}
        tone='positive'
        text={isBusy ? 'Queueing translations...' : 'Generate Translations'}
      />
    </Stack>
  );
};
