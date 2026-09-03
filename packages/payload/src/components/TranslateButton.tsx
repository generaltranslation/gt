'use client';
import { Button, toast, useConfig, useDocumentInfo } from '@payloadcms/ui';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';

import { summarizeLocales } from '../outcome';

export const TranslateButton: React.FC = () => {
  const { id, collectionSlug } = useDocumentInfo();
  const { config } = useConfig();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (id === undefined || id === null || !collectionSlug) return null;

  const translate = async (): Promise<void> => {
    setBusy(true);
    try {
      const response = await fetch(
        `${config.routes.api}/${collectionSlug}/${id}/gt-translate`,
        {
          credentials: 'include',
          method: 'POST',
        }
      );
      const body = await response.json();
      if (!response.ok) {
        toast.error(
          typeof body?.error === 'string'
            ? body.error
            : `translate failed (${response.status})`
        );
        return;
      }
      const { clean, trouble } = summarizeLocales(body.locales ?? {});
      if (trouble.length === 0) {
        toast.success(
          `Translated into ${clean.join(', ')}. Switch locale to review.`
        );
      } else {
        const detail = trouble
          .map((item) => `${item.locale}: ${item.detail}`)
          .join(' | ');
        if (clean.length > 0)
          toast.error(`Translated into ${clean.join(', ')}, but ${detail}`);
        else toast.error(`Translation failed. ${detail}`);
      }
      router.refresh();
    } catch {
      toast.error('translate request failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      buttonStyle='secondary'
      disabled={busy}
      onClick={translate}
      size='medium'
    >
      {busy ? 'Translating...' : 'Translate'}
    </Button>
  );
};
