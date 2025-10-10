import { DocumentActionComponent } from 'sanity';
import { useRouter } from 'sanity/router';
import { TranslateIcon } from '@sanity/icons';

export const translateAction: DocumentActionComponent = (props) => {
  const router = useRouter();

  return {
    label: 'Translate',
    icon: TranslateIcon,
    tone: 'primary',
    onHandle: () => {
      // Switch to the translation tab using the document ID and type
      const { id, type } = props;

      // Navigate to the translation view for this document
      router.navigateIntent('edit', {
        id,
        type,
        view: 'general-translation',
      });
    },
  };
};
