// adapted from https://github.com/sanity-io/sanity-translations-tab. See LICENSE.md for more details.

import { useCallback, useState } from 'react';
import { Badge, Box, Button, Flex, Grid, Spinner, Text } from '@sanity/ui';
import { CheckmarkCircleIcon, DownloadIcon } from '@sanity/icons';
import { LocaleLabel } from './LocaleLabel';

/**
 * What a locale row can be showing.
 *
 * General Translation reports a translation as complete or not, with nothing in
 * between, so a percentage was only ever 0 or 100 — and 0 read identically for
 * "never translated" and "being translated right now".
 */
export type LanguageStatusState =
  | 'not-translated'
  | 'translating'
  | 'ready'
  | 'imported';

type LanguageStatusProps = {
  localeId: string;
  state: LanguageStatusState;
  importFile: () => Promise<void>;
};

const STATE_LABEL: Record<LanguageStatusState, string> = {
  'not-translated': 'Not translated',
  translating: 'Translating…',
  ready: 'Ready to import',
  imported: 'Imported',
};

export const LanguageStatus = ({
  localeId,
  state,
  importFile,
}: LanguageStatusProps) => {
  const [isBusy, setIsBusy] = useState(false);

  const handleImport = useCallback(async () => {
    setIsBusy(true);
    try {
      await importFile();
    } finally {
      setIsBusy(false);
    }
  }, [importFile]);

  return (
    <Grid columns={5} gap={3} paddingX={3} paddingY={2}>
      <Flex columnStart={1} columnEnd={3} align='center'>
        <LocaleLabel localeId={localeId} />
      </Flex>

      <Flex columnStart={3} columnEnd={5} align='center' gap={2}>
        {state === 'translating' && <Spinner size={1} muted />}
        <Text size={1} muted={state !== 'ready'}>
          {STATE_LABEL[state]}
        </Text>
      </Flex>

      <Flex columnStart={5} columnEnd={6} align='center' justify='flex-end'>
        {state === 'imported' ? (
          <Badge tone='positive' fontSize={0} radius={2}>
            <Flex align='center' gap={1}>
              <CheckmarkCircleIcon />
              <Box>Imported</Box>
            </Flex>
          </Badge>
        ) : (
          <Button
            style={{ width: '100%' }}
            mode='ghost'
            fontSize={1}
            padding={2}
            onClick={handleImport}
            text='Import'
            loading={isBusy}
            icon={DownloadIcon}
            disabled={isBusy || state !== 'ready'}
          />
        )}
      </Flex>
    </Grid>
  );
};
