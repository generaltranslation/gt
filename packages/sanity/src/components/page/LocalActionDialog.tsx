import React from 'react';
import { Box, Button, Dialog, Flex, Stack, Text } from '@sanity/ui';
import { useTranslations } from '../TranslationsProvider';
import { SelectedLocalesNote } from './SelectedLocalesNote';

export type LocalActionDialogProps = {
  action: 'save' | 'upload';
  isOpen: boolean;
  onClose: () => void;
  /** Runs once the editor confirms. */
  onConfirm: () => Promise<void>;
  /** True while a write only the caller knows about is running. */
  blocked?: boolean;
};

const COPY = {
  save: {
    header: 'Save local edits',
    confirm: 'Save Local Edits',
    question: (count: number) =>
      count === 1
        ? 'Save the translations currently in Sanity for this document to General Translation?'
        : `Save the translations currently in Sanity for all ${count} documents to General Translation?`,
    detail:
      'Each one replaces the finished translation General Translation holds for the same source, including one that has not been imported yet. A locale that has not been translated from the current source is skipped, and is translated on the next run. No translation is started.',
  },
  upload: {
    header: 'Upload existing translations',
    confirm: 'Upload',
    question: (count: number) =>
      count === 1
        ? 'Upload this document and the translations currently in Sanity to General Translation?'
        : `Upload all ${count} documents and the translations currently in Sanity to General Translation?`,
    detail:
      'Each translation is stored as the finished translation of the document as it is now, so later runs do not translate it again. This replaces any translation General Translation already holds for that version. Use this only when the translations in Sanity are up to date with their source. No translation is started.',
  },
};

/** Confirms Save Local Edits or Upload Existing before it runs. */
export const LocalActionDialog: React.FC<LocalActionDialogProps> = ({
  action,
  isOpen,
  onClose,
  onConfirm,
  blocked = false,
}) => {
  const { documents, isWriteRunning } = useTranslations();
  const copy = COPY[action];

  if (!isOpen) return null;

  return (
    <Dialog
      header={copy.header}
      id={`${action}-local-translations-dialog`}
      onClose={onClose}
      footer={
        <Box padding={3}>
          <Flex gap={2} justify='flex-end'>
            <Button text='Cancel' mode='ghost' onClick={onClose} />
            <Button
              text={copy.confirm}
              disabled={isWriteRunning || blocked}
              onClick={async () => {
                onClose();
                await onConfirm();
              }}
            />
          </Flex>
        </Box>
      }
    >
      <Box padding={4}>
        <Stack gap={3}>
          <Text>{copy.question(documents.length)}</Text>
          <SelectedLocalesNote />
          <Text size={1} muted>
            {copy.detail}
          </Text>
        </Stack>
      </Box>
    </Dialog>
  );
};
