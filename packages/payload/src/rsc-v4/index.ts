import * as ui from '@payloadcms/ui/rsc';
import type { ComponentType } from 'react';
import {
  createTranslationsView,
  type TemplateProps,
} from '../rsc/createTranslationsView';

// Compile against v3 types; this export is provided by the v4 peer dependency.
const { DefaultTemplate } = ui as unknown as {
  DefaultTemplate: ComponentType<TemplateProps>;
};
export const GtTranslationsView = createTranslationsView(DefaultTemplate);
