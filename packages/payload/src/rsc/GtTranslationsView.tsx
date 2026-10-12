import { DefaultTemplate } from '@payloadcms/next/templates';
import { Gutter } from '@payloadcms/ui';
import type { AdminViewServerProps } from 'payload';
import React from 'react';
import { GtTranslationsClient } from '../client/GtTranslationsClient';

// The Translations page, inside Payload's admin layout.
export function GtTranslationsView({
  initPageResult,
  params,
  searchParams,
}: AdminViewServerProps) {
  const { req, locale, permissions, visibleEntities } = initPageResult;
  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={locale}
      params={params}
      payload={req.payload}
      permissions={permissions}
      searchParams={searchParams}
      user={req.user ?? undefined}
      visibleEntities={visibleEntities}
    >
      <Gutter>
        <GtTranslationsClient />
      </Gutter>
    </DefaultTemplate>
  );
}
