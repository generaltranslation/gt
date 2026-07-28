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
      header='Save local edits'
      id='upload-existing-dialog'
      onClose={onClose}
      footer={
        <Box padding={3}>
          <Flex gap={2}>
            <Button text='Cancel' mode='ghost' onClick={onClose} />
            <Button text='Save Local Edits' onClick={handleConfirm} />
          </Flex>
        </Box>
      }
    >
      <Box padding={4}>
        <Stack space={3}>
          <Text>
            Save the translations currently in Sanity for all {documents.length}{' '}
            documents to General Translation?
          </Text>
          <Text size={1} muted>
            They become the stored translation for each locale, so later
            translation runs reuse them. Anything General Translation already
            holds for those versions is replaced. No translation is started.
          </Text>
        </Stack>
      </Box>
    </Dialog>
  );
};
