import React from 'react';
import { Box, Button, Dialog, Flex, Stack, Text } from '@sanity/ui';
import { useTranslations } from '../TranslationsProvider';
import { SelectedLocalesNote } from './SelectedLocalesNote';

interface SaveLocalEditsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SaveLocalEditsDialog: React.FC<SaveLocalEditsDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const { documents, handleSaveLocalEdits } = useTranslations();

  const handleConfirm = async () => {
    onClose();
    await handleSaveLocalEdits();
  };

  if (!isOpen) return null;

  return (
    <Dialog
      header='Save local edits'
      id='save-local-edits-dialog'
      onClose={onClose}
      footer={
        <Box padding={3}>
          <Flex gap={2} justify='flex-end'>
            <Button text='Cancel' mode='ghost' onClick={onClose} />
            <Button text='Save Local Edits' onClick={handleConfirm} />
          </Flex>
        </Box>
      }
    >
      <Box padding={4}>
        <Stack gap={3}>
          <Text>
            Save the translations currently in Sanity for all {documents.length}{' '}
            documents to General Translation?
          </Text>
          <SelectedLocalesNote />
          <Text size={1} muted>
            They replace the translation General Translation holds for the
            source it last received. Source changes made since then are still
            translated on the next run. No translation is started.
          </Text>
        </Stack>
      </Box>
    </Dialog>
  );
};
