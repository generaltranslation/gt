import type { ComponentType, ReactNode } from 'react';
import { Gutter } from '@payloadcms/ui';
import type {
  AdminViewServerProps,
  ServerProps,
  VisibleEntities,
} from 'payload';
import React from 'react';
import { GtTranslationsClient } from '../client/GtTranslationsClient';

export type TemplateProps = Omit<ServerProps, 'server'> & {
  req?: AdminViewServerProps['initPageResult']['req'];
  children?: ReactNode;
  visibleEntities: VisibleEntities;
};

// Each entry imports only the template path available in its Payload major.
export function createTranslationsView(
  DefaultTemplate: ComponentType<TemplateProps>
) {
  return function GtTranslationsView({
    initPageResult,
    params,
    searchParams,
  }: AdminViewServerProps) {
    const { req, locale, permissions, visibleEntities } = initPageResult;
    return (
      <DefaultTemplate
        req={req}
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
  };
}
