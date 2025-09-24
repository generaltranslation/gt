import React from 'react';
import { Box, Button, Dialog, Flex, Stack, Text } from '@sanity/ui';
import { useTranslations } from '../TranslationsProvider';

interface ImportAllDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImportAllDialog: React.FC<ImportAllDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const { documents, handleImportAll } = useTranslations();

  const handleConfirm = async () => {
    onClose();
    await handleImportAll();
  };

  if (!isOpen) return null;

  return (
    <Dialog
      header='Confirm Import'
      id='import-all-dialog'
      onClose={onClose}
      footer={
        <Box padding={3}>
          <Flex gap={2}>
            <Button text='Cancel' mode='ghost' onClick={onClose} />
            <Button text='Import All' tone='primary' onClick={handleConfirm} />
          </Flex>
        </Box>
      }
    >
      <Box padding={4}>
        <Stack space={3}>
          <Text>
            Are you sure you want to import translations for all{' '}
            {documents.length} documents?
          </Text>
          <Text size={1} muted>
            This will download and apply translated content to your documents.
            Note that this will overwrite any existing translations!
          </Text>
        </Stack>
      </Box>
    </Dialog>
  );
};
