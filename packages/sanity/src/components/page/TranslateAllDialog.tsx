import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  Checkbox,
  Dialog,
  Flex,
  Stack,
  Text,
} from '@sanity/ui';
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
  const [force, setForce] = useState(false);

  const handleConfirm = async () => {
    onClose();
    setForce(false);
    await handleTranslateAll({ force });
  };

  const handleCancel = () => {
    setForce(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Dialog
      header='Confirm Translation'
      id='translate-all-dialog'
      onClose={handleCancel}
      footer={
        <Box padding={3}>
          <Flex gap={2}>
            <Button text='Cancel' mode='ghost' onClick={handleCancel} />
            <Button
              text={force ? 'Retranslate All' : 'Translate All'}
              tone={force ? 'caution' : 'default'}
              onClick={handleConfirm}
            />
          </Flex>
        </Box>
      }
    >
      <Box padding={4}>
        <Stack space={4}>
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

          <Card
            padding={3}
            radius={2}
            tone={force ? 'caution' : 'transparent'}
            border
          >
            <Flex align='flex-start' gap={3}>
              <Checkbox
                id='translate-all-force'
                checked={force}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setForce(event.currentTarget.checked)
                }
              />
              <Stack space={2} flex={1}>
                <Text size={1} weight='medium'>
                  <label htmlFor='translate-all-force'>
                    Retranslate from scratch
                  </label>
                </Text>
                <Text size={1} muted>
                  {force
                    ? 'Existing translations will be discarded and regenerated. Edits made to translated documents will be lost.'
                    : 'Leave unchecked to reuse existing translations, including edits made to translated documents in the Studio.'}
                </Text>
              </Stack>
            </Flex>
          </Card>
        </Stack>
      </Box>
    </Dialog>
  );
};
