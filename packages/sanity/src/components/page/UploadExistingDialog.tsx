import React from 'react';
import { Box, Button, Dialog, Flex, Stack, Text } from '@sanity/ui';
import { useTranslations } from '../TranslationsProvider';
import { SelectedLocalesNote } from './SelectedLocalesNote';

export interface LocalActionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Runs the action; defaults to the provider's handler. */
  onConfirm?: () => Promise<void>;
}

export const UploadExistingDialog: React.FC<LocalActionDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const { documents, handleUploadExistingTranslations } = useTranslations();

  const handleConfirm = async () => {
    onClose();
    await (onConfirm ?? handleUploadExistingTranslations)();
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
            {documents.length === 1
              ? 'Upload this document and the translations'
              : `Upload all ${documents.length} documents and the translations`}{' '}
            currently in Sanity to General Translation?
          </Text>
          <SelectedLocalesNote />
          <Text size={1} muted>
            Each translation is stored as the finished translation of the
            document as it is now, so later runs do not translate it again. This
            replaces any translation General Translation already holds for that
            version. Use this only when the translations in Sanity are up to
            date with their source. No translation is started.
          </Text>
        </Stack>
      </Box>
    </Dialog>
  );
};
