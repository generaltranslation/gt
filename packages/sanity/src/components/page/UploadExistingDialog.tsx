import React from 'react';
import { Box, Button, Dialog, Flex, Stack, Text } from '@sanity/ui';
import { useTranslations } from '../TranslationsProvider';

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
      header='Upload Existing Translations'
      id='upload-existing-dialog'
      onClose={onClose}
      footer={
        <Box padding={3}>
          <Flex gap={2}>
            <Button text='Cancel' mode='ghost' onClick={onClose} />
            <Button text='Upload Existing' onClick={handleConfirm} />
          </Flex>
        </Box>
      }
    >
      <Box padding={4}>
        <Stack space={3}>
          <Text>
            Upload the translations already in Sanity for all {documents.length}{' '}
            documents?
          </Text>
          <Text size={1} muted>
            The translated content currently in Sanity will be stored on General
            Translation as the translation for each locale, preserving human
            edits. Existing translations on the platform are overwritten.
          </Text>
        </Stack>
      </Box>
    </Dialog>
  );
};
