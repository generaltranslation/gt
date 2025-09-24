import React from 'react';
import { Box, Button, Dialog, Flex, Stack, Text } from '@sanity/ui';
import { useTranslations } from '../TranslationsProvider';

interface TranslateAllDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TranslateAllDialog: React.FC<TranslateAllDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const { documents, handleTranslateAll } = useTranslations();

  const handleConfirm = async () => {
    onClose();
    await handleTranslateAll();
  };

  if (!isOpen) return null;

  return (
    <Dialog
      header='Confirm Translation'
      id='translate-all-dialog'
      onClose={onClose}
      footer={
        <Box padding={3}>
          <Flex gap={2}>
            <Button text='Cancel' mode='ghost' onClick={onClose} />
            <Button
              text='Translate All'
              tone='critical'
              onClick={handleConfirm}
            />
          </Flex>
        </Box>
      }
    >
      <Box padding={4}>
        <Stack space={3}>
          <Text>
            Are you sure you want to create translations for all{' '}
            {documents.length} documents?
          </Text>
          <Text size={1} muted>
            This will submit all documents to General Translation for
            processing.
          </Text>
        </Stack>
      </Box>
    </Dialog>
  );
};
