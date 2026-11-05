import { msg } from 'gt-react/experimental';

const footerText = msg('Shared footer');
// A custom hash: unattributed, so it keeps its text and is reported
const legacyText = msg('Legacy footer', { $_hash: 'legacy-footer' });

export function renderFooter() {
  return footerText + legacyText;
}
