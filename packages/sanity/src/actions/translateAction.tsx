import { DocumentActionComponent } from 'sanity';
import { useDocumentPane } from 'sanity/structure';
import { TranslateIcon } from '@sanity/icons';
import { TRANSLATIONS_INSPECTOR_NAME } from '../inspectors/translationsInspector';

export const translateAction: DocumentActionComponent = () => {
  const { openInspector, inspector } = useDocumentPane();
  const isOpen = inspector?.name === TRANSLATIONS_INSPECTOR_NAME;

  return {
    label: 'Translate',
    icon: TranslateIcon,
    tone: 'primary',
    onHandle: () => {
      if (!isOpen) {
        openInspector(TRANSLATIONS_INSPECTOR_NAME);
      }
    },
  };
};
