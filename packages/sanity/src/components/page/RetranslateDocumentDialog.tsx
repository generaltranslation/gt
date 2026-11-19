import React from 'react';
import { Box, Button, Card, Dialog, Flex, Stack, Text } from '@sanity/ui';
import { LocaleLabel } from '../shared/LocaleLabel';

interface RetranslateDocumentDialogProps {
  isOpen: boolean;
  localeIds: string[];
  onClose: () => void;
  onConfirm: () => void;
}

export const RetranslateDocumentDialog: React.FC<
  RetranslateDocumentDialogProps
> = ({ isOpen, localeIds, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <Dialog
      header='Retranslate from scratch'
      id='retranslate-document-dialog'
      onClose={onClose}
      footer={
        <Box padding={3}>
          <Flex gap={2} justify='flex-end'>
            <Button text='Cancel' mode='ghost' onClick={onClose} />
            <Button text='Retranslate' tone='caution' onClick={onConfirm} />
          </Flex>
        </Box>
      }
    >
      <Box padding={4}>
        <Stack gap={5}>
          <Text>
            This document is translated again from scratch into the selected
            locales. Any saved translation is ignored, even if the document has
            not changed.
          </Text>

          <Stack gap={3}>
            <Text size={1} muted>
              {localeIds.length === 1 ? 'Locale' : 'Locales'}
            </Text>
            <Flex gap={3} wrap='wrap'>
              {localeIds.map((localeId) => (
                <LocaleLabel key={localeId} localeId={localeId} />
              ))}
            </Flex>
          </Stack>

          <Card padding={4} radius={2} tone='caution' border>
            <Stack gap={3}>
              <Text size={1} weight='medium'>
                Existing translations are replaced
              </Text>
              <Text size={1}>
                With auto-import on, the new result replaces what is currently
                in the translated documents as soon as it completes, including
                edits made to them in the Studio. A published translation
                receives it as a draft unless auto-publish is on.
              </Text>
            </Stack>
          </Card>
        </Stack>
      </Box>
    </Dialog>
  );
};
