import {
  GTProvider as ReactGTProvider,
  type SharedGTProviderProps,
} from 'gt-react';
import { getClientReload } from '../setup/initializeGT.client';

export function GTProvider(props: SharedGTProviderProps) {
  return (
    <ReactGTProvider {...props} _reload={props._reload ?? getClientReload()} />
  );
}
