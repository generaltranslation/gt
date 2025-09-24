import React from 'react';
import { Box, Button, Dialog, Flex, Stack, Text } from '@sanity/ui';
import { useTranslations } from './TranslationsProvider';

interface ImportMissingDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImportMissingDialog: React.FC<ImportMissingDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const { handleImportMissing } = useTranslations();

  const handleConfirm = async () => {
    onClose();
    await handleImportMissing();
  };

  if (!isOpen) return null;

  return (
    <Dialog
      header="Confirm Import Missing"
      id="import-missing-dialog"
      onClose={onClose}
      footer={
        <Box padding={3}>
          <Flex gap={2}>
            <Button text="Cancel" mode="ghost" onClick={onClose} />
            <Button text="Import Missing" tone="primary" onClick={handleConfirm} />
          </Flex>
        </Box>
      }
    >
      <Box padding={4}>
        <Stack space={3}>
          <Text>
            Import only the missing translations (translations that are ready but
            haven't been imported to Sanity yet)?
          </Text>
          <Text size={1} muted>
            This will check existing translation metadata and only import
            translations that don't already exist in your dataset.
          </Text>
        </Stack>
      </Box>
    </Dialog>
  );
};