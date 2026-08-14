// adapted from https://github.com/sanity-io/sanity-translations-tab. See LICENSE.md for more details.

import { useCallback, useState } from 'react';
import { Badge, Box, Button, Flex, Grid, Spinner, Text } from '@sanity/ui';
import { CheckmarkCircleIcon } from '@sanity/icons/CheckmarkCircle';
import { DownloadIcon } from '@sanity/icons/Download';
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
  /**
   * This locale is part of an import running elsewhere, such as Import All.
   * The row's own button state only covers a click on that button, so without
   * this a bulk import leaves every row looking idle until it finishes.
   */
  isImporting?: boolean;
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
  isImporting = false,
}: LanguageStatusProps) => {
  const [isSelfImporting, setIsSelfImporting] = useState(false);
  // A bulk import reports every queued locale at once and only clears the set
  // when the whole run ends, so a row that has already landed must stop
  // reporting itself as in progress on its own.
  const isBusy = (isSelfImporting || isImporting) && state !== 'imported';

  const handleImport = useCallback(async () => {
    setIsSelfImporting(true);
    try {
      await importFile();
    } finally {
      setIsSelfImporting(false);
    }
  }, [importFile]);

  return (
    <Grid gridTemplateColumns={5} gap={3} paddingX={3} paddingY={2}>
      <Flex gridColumnStart={1} gridColumnEnd={3} align='center'>
        <LocaleLabel localeId={localeId} />
      </Flex>

      <Flex gridColumnStart={3} gridColumnEnd={5} align='center' gap={2}>
        {(state === 'translating' || isBusy) && <Spinner size={1} muted />}
        <Text size={1} muted={state !== 'ready'}>
          {isBusy ? 'Importing…' : STATE_LABEL[state]}
        </Text>
      </Flex>

      <Flex
        gridColumnStart={5}
        gridColumnEnd={6}
        align='center'
        justify='flex-end'
      >
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
            text={isBusy ? 'Importing…' : 'Import'}
            loading={isBusy}
            icon={DownloadIcon}
            disabled={isBusy || state !== 'ready'}
          />
        )}
      </Flex>
    </Grid>
  );
};
