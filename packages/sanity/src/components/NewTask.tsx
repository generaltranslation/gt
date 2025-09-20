// adapted from https://github.com/sanity-io/sanity-translations-tab. See LICENSE.md for more details.

import React, {
  useState,
  useContext,
  ChangeEvent,
  useCallback,
  useEffect,
} from 'react';
import styled from 'styled-components';
import {
  Button,
  Box,
  Flex,
  Grid,
  Select,
  Stack,
  Switch,
  Text,
  useToast,
} from '@sanity/ui';

import { TranslationContext } from './TranslationContext';
import { TranslationLocale } from '../types';

type Props = {
  locales: TranslationLocale[];
  refreshTask: () => Promise<void>;
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

export const NewTask = ({ locales, refreshTask }: Props) => {
  const possibleLocales = locales.filter((locale) => locale.enabled !== false);
  // Lets just stick to the canonical document id for keeping track of
  // translations
  const [selectedLocales, setSelectedLocales] = useState<React.ReactNode[]>(
    locales
      .filter((locale) => locale.enabled !== false)
      .map((locale) => locale.localeId)
  );

  useEffect(() => {
    setSelectedLocales(
      locales
        .filter((locale) => locale.enabled !== false)
        .map((locale) => locale.localeId)
    );
  }, [locales]);

  const [selectedWorkflowUid, setSelectedWorkflowUid] = useState<string>();
  const [isBusy, setIsBusy] = useState(false);

  const context = useContext(TranslationContext);
  const toast = useToast();

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

  const createTask = useCallback(() => {
    if (!context) {
      toast.push({
        title: 'Unable to create task: missing context',
        status: 'error',
        closable: true,
      });
      return;
    }

    setIsBusy(true);

    context
      .exportForTranslation(context.documentInfo)
      .then((serialized) =>
        context.adapter.createTask(
          context.documentInfo,
          serialized,
          selectedLocales as string[],
          context.secrets,
          selectedWorkflowUid,
          context.callbackUrl
        )
      )
      .then(() => {
        toast.push({
          title: 'Job successfully created',
          status: 'success',
          closable: true,
        });

        /** Reset form fields */
        setSelectedLocales([]);
        setSelectedWorkflowUid('');

        /** Update task data in TranslationView */
        refreshTask();
      })
      .catch((err) => {
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
      })
      .finally(() => {
        setIsBusy(false);
      });
  }, [context, selectedLocales, selectedWorkflowUid, toast, refreshTask]);

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

  const onWorkflowChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      setSelectedWorkflowUid(e.target.value);
    },
    [setSelectedWorkflowUid]
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

      {context?.workflowOptions && context.workflowOptions.length > 0 && (
        <Stack space={3}>
          <Text weight='semibold' size={1} as='label' htmlFor='workflow-select'>
            Select translation workflow
          </Text>
          <Grid columns={[1, 1, 2]}>
            <Select id='workflowSelect' onChange={onWorkflowChange}>
              <option>Default locale workflows</option>
              {context.workflowOptions.map((w) => (
                <option
                  key={`workflow-opt-${w.workflowUid}`}
                  value={w.workflowUid}
                >
                  {w.workflowName}
                </option>
              ))}
            </Select>
          </Grid>
        </Stack>
      )}

      <Button
        onClick={createTask}
        disabled={isBusy || !selectedLocales.length}
        tone='positive'
        text={isBusy ? 'Queueing translations...' : 'Generate Translations'}
      />
    </Stack>
  );
};
