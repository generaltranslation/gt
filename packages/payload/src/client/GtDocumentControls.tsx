'use client';
import {
  Button,
  Drawer,
  formatDrawerSlug,
  useDocumentInfo,
  useEditDepth,
  useFormModified,
  useModal,
} from '@payloadcms/ui';
import { useRouter } from 'next/navigation';
import React from 'react';
import type { TranslateTarget } from '../types';
import { TranslatePanel } from './TranslatePanel';

// A Translate button on a document's edit view, opening the translate panel
// in a drawer.
export function GtDocumentControls() {
  const { id, collectionSlug, globalSlug } = useDocumentInfo();
  const router = useRouter();
  const modified = useFormModified();
  const { openModal } = useModal();
  const slug = formatDrawerSlug({
    slug: 'gt-translations',
    depth: useEditDepth(),
  });
  const target: TranslateTarget | null = globalSlug
    ? { global: globalSlug }
    : collectionSlug && id !== undefined
      ? { collection: collectionSlug, id }
      : null;
  if (!target) return null;
  return (
    <div data-testid='gt-document-controls'>
      <Button
        buttonStyle='secondary'
        size='medium'
        margin={false}
        id='gt-open-translations'
        onClick={() => openModal(slug)}
      >
        Translate
      </Button>
      <Drawer slug={slug} title='Translations'>
        <TranslatePanel
          scope={{ targets: [target] }}
          onTranslated={() => router.refresh()}
          blocked={
            modified ? 'Save your changes before translating.' : undefined
          }
        />
      </Drawer>
    </div>
  );
}
