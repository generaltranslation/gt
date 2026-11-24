import React from 'react';
import { Box, Button, Dialog, Flex, Stack, Text } from '@sanity/ui';
import { useTranslations } from '../TranslationsProvider';
import { SelectedLocalesNote } from './SelectedLocalesNote';

interface UploadExistingDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UploadExistingDialog: React.FC<UploadExistingDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const { documents, handleUploadExistingTranslations } = useTranslations();

  const handleConfirm = async () => {
    onClose();
    await handleUploadExistingTranslations();
  };

  if (!isOpen) return null;

  return (
    <Dialog
      header='Upload existing translations'
      id='upload-existing-dialog'
      onClose={onClose}
      footer={
        <Box padding={3}>
          <Flex gap={2} justify='flex-end'>
            <Button text='Cancel' mode='ghost' onClick={onClose} />
            <Button text='Upload' onClick={handleConfirm} />
          </Flex>
        </Box>
      }
    >
      <Box padding={4}>
        <Stack gap={3}>
          <Text>
            Upload all {documents.length} documents and the translations
            currently in Sanity to General Translation?
          </Text>
          <SelectedLocalesNote />
          <Text size={1} muted>
            Each translation is stored as the finished translation of the
            document as it is now, so later runs do not translate it again. Use
            this only when the translations in Sanity are up to date with their
            source. No translation is started.
          </Text>
        </Stack>
      </Box>
    </Dialog>
  );
};
