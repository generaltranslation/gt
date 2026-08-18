import React from 'react';
import { Box, Button, Card, Dialog, Flex, Stack, Text } from '@sanity/ui';

interface SaveLocalTranslationsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const SaveLocalTranslationsDialog: React.FC<
  SaveLocalTranslationsDialogProps
> = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <Dialog
      header='Save local edits'
      id='save-local-translations-dialog'
      onClose={onClose}
      footer={
        <Box padding={3}>
          <Flex gap={2}>
            <Button text='Cancel' mode='ghost' onClick={onClose} />
            <Button text='Turn on' tone='primary' onClick={onConfirm} />
          </Flex>
        </Box>
      }
    >
      <Box padding={4}>
        <Stack gap={4}>
          <Text>
            Before each translation run, the translations currently in Sanity
            are sent to General Translation. Content whose source text has not
            changed is then reused from Sanity instead of being translated
            again, so edits made here are kept.
          </Text>

          <Card padding={3} radius={2} tone='caution' border>
            <Stack gap={3}>
              <Text size={1} weight='medium'>
                Sanity becomes the source of truth
              </Text>
              <Text size={1}>
                What is in Sanity replaces whatever General Translation holds
                for that version of the document — including a translation that
                has finished but has not been imported yet. Import any pending
                translations before turning this on.
              </Text>
            </Stack>
          </Card>

          <Text size={1} muted>
            This applies to translation runs started from this Studio session.
            To send them without starting a run, use Save Local Edits.
          </Text>
        </Stack>
      </Box>
    </Dialog>
  );
};
