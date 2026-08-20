import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Card, Dialog, Flex, Stack } from '@sanity/ui';
import { Code } from '@sanity/ui/code';
import { ClipboardIcon } from '@sanity/icons/Clipboard';
import { useClient } from '../../hooks/useClient';
import { useTranslations } from '../TranslationsProvider';
import { buildDebugInfo, formatDebugInfo } from '../../utils/debugInfo';
import {
  collectTranslationSummary,
  EMPTY_TRANSLATION_SUMMARY,
  type TranslationSummary,
} from '../../utils/translationSummary';

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
    documents,
    branchId,
    autoRefresh,
    autoImport,
    autoPatchReferences,
    autoPublish,
    preserveExistingTranslations,
  } = useTranslations();
  const client = useClient();
  const [copied, setCopied] = useState(false);
  const [translations, setTranslations] = useState<TranslationSummary>(
    EMPTY_TRANSLATION_SUMMARY
  );

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
          translations,
          sanityProjectId: projectId,
          sanityDataset: dataset,
          branchId,
        })
      ),
    [
      secrets,
      translations,
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

  // Reads the dataset, so it runs when the dialog opens rather than on every
  // status poll. Failures leave the zeroed summary rather than blocking the
  // rest of the debug output.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    collectTranslationSummary(documents, client)
      .then((summary) => {
        if (!cancelled) setTranslations(summary);
      })
      .catch(() => {
        if (!cancelled) setTranslations(EMPTY_TRANSLATION_SUMMARY);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, documents, client]);

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
        <Stack gap={4}>
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
