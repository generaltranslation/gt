import { ServerGTProvider as RegularServerGTProvider } from '../../provider/ServerGTProvider';
import { NO_TRANSLATIONS, type SharedGTProviderProps } from './GTProviderProps';

/**
 * The server GTProvider with locale twins: the server renders from the
 * whole locale it loaded, so no translations snapshot is needed.
 */
export function ServerGTProvider({
  translations = NO_TRANSLATIONS,
  ...props
}: SharedGTProviderProps) {
  return <RegularServerGTProvider {...props} translations={translations} />;
}
