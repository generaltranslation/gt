import { Button } from '@sanity/ui';
import { TranslateIcon } from '@sanity/icons';
import { useRouter } from 'sanity/router';

export function TranslateButton() {
  const router = useRouter();

  const handleClick = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const panes = router.state.panes as any[];
    if (panes && panes.length > 0) {
      const currentPane = panes[0];
      router.navigateUrl({
        ...currentPane,
        view: 'general-translation',
      });
    }
  };

  return (
    <Button
      icon={TranslateIcon}
      text='Translate'
      onClick={handleClick}
      mode='ghost'
      tone='primary'
    />
  );
}
