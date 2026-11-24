import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import * as client from '../index.client';
import * as testing from '../testing';

const { GTProvider, T, initializeGT, m, msg, t, useGT, useMessages } = testing;
const save = msg('Save');

function Probe() {
  const t = useGT();
  const messages = useMessages();
  return (
    <>
      {t`Save`}|{messages(save)}|<T>Save</T>
    </>
  );
}

describe('gt-react/testing', () => {
  it('renders source text with no setup and no provider', () => {
    expect(renderToString(<Probe />).replace(/<!-- -->/g, '')).toBe(
      'Save|Save|Save'
    );
    expect(`${t`Save`}|${m(save)}`).toBe('Save|Save');
  });

  it('keeps rendering source text when the app sets GT up and wraps itself in a provider', () => {
    initializeGT({ defaultLocale: 'fr' });

    expect(
      renderToString(
        <GTProvider>
          <Probe />
        </GTProvider>
      ).replace(/<!-- -->/g, '')
    ).toBe('Save|Save|Save');
    expect(testing.getDefaultLocale()).toBe('fr');
  });

  it('lets app setup create the browser condition store, and still renders source text', () => {
    expect(() => testing.createOrUpdateBrowserConditionStore({})).not.toThrow();

    expect(renderToString(<Probe />).replace(/<!-- -->/g, '')).toBe(
      'Save|Save|Save'
    );
  });

  it('exports every name the client entry exports', () => {
    expect(Object.keys(testing).sort()).toEqual(Object.keys(client).sort());
  });
});
