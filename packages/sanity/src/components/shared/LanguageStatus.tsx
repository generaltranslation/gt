// adapted from https://github.com/sanity-io/sanity-translations-tab. See LICENSE.md for more details.

import { useCallback, useState } from 'react';
import { Badge, Box, Button, Flex, Grid } from '@sanity/ui';
import { CheckmarkCircleIcon, DownloadIcon } from '@sanity/icons';
import ProgressBar from './ProgressBar';
import { LocaleLabel } from './LocaleLabel';

type LanguageStatusProps = {
  localeId: string;
  progress: number;
  importFile: () => Promise<void>;
  isImported?: boolean;
};

export const LanguageStatus = ({
  localeId,
  progress,
  importFile,
  isImported = false,
}: LanguageStatusProps) => {
  const [isBusy, setIsBusy] = useState(false);
  const displayedProgress = isImported && progress < 100 ? 100 : progress;

  const handleImport = useCallback(async () => {
    setIsBusy(true);
    try {
      await importFile();
    } finally {
      setIsBusy(false);
    }
  }, [importFile, setIsBusy]);

  return (
    <Grid columns={5} gap={3} paddingX={3} paddingY={2}>
      <Flex columnStart={1} columnEnd={3} align='center'>
        <LocaleLabel localeId={localeId} />
      </Flex>
      {typeof displayedProgress === 'number' ? (
        <Flex columnStart={3} columnEnd={5} align='center'>
          <ProgressBar progress={displayedProgress} />
        </Flex>
      ) : null}
      <Flex columnStart={5} columnEnd={6} align='center' justify='flex-end'>
        {isImported ? (
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
            text={isBusy ? 'Importing...' : 'Import'}
            icon={isBusy ? null : DownloadIcon}
            disabled={isBusy || !progress || progress < 100}
          />
        )}
      </Flex>
    </Grid>
  );
};
