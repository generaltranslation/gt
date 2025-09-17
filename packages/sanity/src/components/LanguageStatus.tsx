import { useCallback, useState } from 'react';
import { Flex, Card, Text, Grid, Box, Button } from '@sanity/ui';
import { DownloadIcon, CheckmarkCircleIcon } from '@sanity/icons';
import ProgressBar from './ProgressBar';

type LanguageStatusProps = {
  title: string;
  progress: number;
  importFile: () => Promise<void>;
  isImported?: boolean;
};

export const LanguageStatus = ({
  title,
  progress,
  importFile,
  isImported = false,
}: LanguageStatusProps) => {
  const [isBusy, setIsBusy] = useState(false);

  const handleImport = useCallback(async () => {
    setIsBusy(true);
    await importFile();
    setIsBusy(false);
  }, [importFile, setIsBusy]);

  return (
    <Card shadow={1}>
      <Grid columns={5} gap={3} padding={3}>
        <Flex columnStart={1} columnEnd={3} align='center'>
          <Text weight='bold' size={1}>
            {title}
          </Text>
        </Flex>
        {typeof progress === 'number' ? (
          <Flex columnStart={3} columnEnd={5} align='center'>
            <ProgressBar progress={progress} />
          </Flex>
        ) : null}
        <Box columnStart={5} columnEnd={6}>
          {isImported ? (
            <Flex align='center' justify='center' style={{ color: 'green' }}>
              <CheckmarkCircleIcon />
              <Text size={1} style={{ marginLeft: '4px' }}>Imported</Text>
            </Flex>
          ) : (
            <Button
              style={{ width: `100%` }}
              mode='ghost'
              onClick={handleImport}
              text={isBusy ? 'Importing...' : 'Import'}
              icon={isBusy ? null : DownloadIcon}
              disabled={isBusy || !progress || progress < 100}
            />
          )}
        </Box>
      </Grid>
    </Card>
  );
};
