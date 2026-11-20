import { createFileRoute } from '@tanstack/react-router';
import { useTranslations } from 'gt-tanstack-start/compat';

// Renders only in a build whose router is set up from gt-tanstack-start/compat
// (CHECK_COMPAT), which provides the dictionary.
export const Route = createFileRoute('/dictionary')({
  component: Dictionary,
});

function Dictionary() {
  const d = useTranslations();
  return (
    <main data-page='dictionary'>
      <h1 data-m data-src='Hello from the dictionary'>
        {d('greeting')}
      </h1>
      <p data-m data-src='Looked up by its key'>
        {d('menu.title')}
      </p>
    </main>
  );
}
