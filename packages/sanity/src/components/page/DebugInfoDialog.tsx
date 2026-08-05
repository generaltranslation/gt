import React, { useMemo, useState } from 'react';
import { Box, Button, Card, Code, Dialog, Flex, Stack, Text } from '@sanity/ui';
import { ClipboardIcon } from '@sanity/icons';
import { useClient } from '../../hooks/useClient';
import { useTranslations } from '../TranslationsProvider';
import { buildDebugInfo, formatDebugInfo } from '../../utils/debugInfo';

interface DebugInfoDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DebugInfoDialog: React.FC<DebugInfoDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    secrets,
    branchId,
    autoRefresh,
    autoImport,
    autoPatchReferences,
    autoPublish,
    preserveExistingTranslations,
  } = useTranslations();
  const client = useClient();
  const [copied, setCopied] = useState(false);

  const { projectId, dataset } = client.config();

  const serialized = useMemo(
    () =>
      formatDebugInfo(
        buildDebugInfo({
          secrets,
          preferences: {
            autoRefresh,
            autoImport,
            autoPatchReferences,
            autoPublish,
            preserveExistingTranslations,
          },
          sanityProjectId: projectId,
          sanityDataset: dataset,
          branchId,
        })
      ),
    [
      secrets,
      branchId,
      projectId,
      dataset,
      autoRefresh,
      autoImport,
      autoPatchReferences,
      autoPublish,
      preserveExistingTranslations,
    ]
  );

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(serialized);
      setCopied(true);
    } catch {
      // Clipboard unavailable (insecure origin, denied permission) — the text
      // is on screen and selectable.
      setCopied(false);
    }
  };

  return (
    <Dialog
      header='Debug info'
      id='gt-debug-info-dialog'
      onClose={onClose}
      width={2}
      footer={
        <Box padding={3}>
          <Flex gap={2} justify='space-between' align='center'>
            <Button
              icon={ClipboardIcon}
              text={copied ? 'Copied' : 'Copy'}
              tone={copied ? 'positive' : 'default'}
              mode='ghost'
              onClick={handleCopy}
            />
            <Button text='Close' mode='ghost' onClick={onClose} />
          </Flex>
        </Box>
      }
    >
      <Box padding={4}>
        <Stack space={4}>
          <Text size={1} muted>
            The plugin&apos;s effective configuration. Copy this into a support
            request to show how the Studio is set up. Your API key is not
            included.
          </Text>
          <Card
            padding={3}
            radius={2}
            tone='transparent'
            border
            overflow='auto'
            style={{ maxHeight: '50vh' }}
          >
            <Code size={0} language='json'>
              {serialized}
            </Code>
          </Card>
        </Stack>
      </Box>
    </Dialog>
  );
};
