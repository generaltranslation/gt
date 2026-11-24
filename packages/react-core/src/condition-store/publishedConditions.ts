import { createGlobalSingleton } from 'gt-i18n/internal';

type Conditions = { locale: string; enableI18n: boolean };

// Apart from the condition store: a browser app keeps a writable store there, which a provider's conditions must not replace.
const publishedConditions = createGlobalSingleton<Conditions[]>({
  namespace: 'reactCore',
  key: 'publishedConditions',
  notInitialized: () => 'No provider has published its conditions',
});

function getPublishedConditions(): Conditions[] {
  if (!publishedConditions.isInitialized()) publishedConditions.set([]);
  return publishedConditions.get();
}

/**
 * Makes a mounted provider's conditions readable outside the component tree,
 * until the returned function is called.
 */
export function publishConditions(conditions: Conditions): () => void {
  const published = getPublishedConditions();
  published.push(conditions);
  return () => {
    published.splice(published.indexOf(conditions), 1);
  };
}

/** The conditions of the provider that rendered last, when one is mounted. */
export function readPublishedConditions(): Conditions | undefined {
  const published = getPublishedConditions();
  return published[published.length - 1];
}
