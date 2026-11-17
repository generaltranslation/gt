import { ClientLabel } from './client-label';
import { serverGreeting } from './server-messages';

export default function Page() {
  return <ClientLabel message={serverGreeting} />;
}
