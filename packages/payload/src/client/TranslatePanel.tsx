'use client';
import { Button, CheckboxInput, useConfig } from '@payloadcms/ui';
import React from 'react';
import { apiRoute, progressLabel, type Scope } from './api';
import { LocalePicker } from './LocalePicker';
import { useLocaleOptions } from './locales';
import { isBoolean, isStringList, useRemembered } from './preferences';
import { useTranslate } from './useTranslate';

// Pick languages, translate, and save local edits, for one document or the
// whole site. With a blocked message, translating waits on the user.
export function TranslatePanel({
  scope,
  onTranslated,
  blocked,
}: {
  scope: Scope;
  onTranslated?: () => void;
  blocked?: string;
}) {
  const { config } = useConfig();
  const route = apiRoute(config);
  const options = useLocaleOptions();
  const codes = options.filter((o) => o.supported).map((o) => o.code);
  const [remembered, setSelected] = useRemembered(
    'locales',
    codes,
    isStringList
  );
  const selected = remembered.filter((code) => codes.includes(code));
  const [saveLocalEdits, setSaveLocalEdits] = useRemembered(
    'saveLocalEdits',
    false,
    isBoolean
  );
  const { progress, busy, run, save } = useTranslate(options, onTranslated);
  const languages =
    selected.length === 1
      ? options.find((o) => o.code === selected[0])?.name
      : `${selected.length} languages`;

  return (
    <div
      data-testid='gt-translate-panel'
      style={{ display: 'grid', gap: 'calc(var(--base) * 1.5)' }}
    >
      <section style={{ display: 'grid', gap: 'var(--base)' }}>
        <LocalePicker
          options={options}
          selected={selected}
          onChange={setSelected}
          disabled={busy}
        />
        <CheckboxInput
          id='gt-save-local-edits'
          checked={saveLocalEdits}
          label='Save local edits before translating'
          readOnly={busy}
          onToggle={(event) => setSaveLocalEdits(event.target.checked)}
        />
        {blocked && (
          <p style={{ margin: 0, color: 'var(--theme-warning-500)' }}>
            {blocked}
          </p>
        )}
        <div>
          <Button
            buttonStyle='primary'
            margin={false}
            id='gt-translate'
            disabled={busy || Boolean(blocked) || selected.length === 0}
            onClick={() => void run(route, scope, selected, saveLocalEdits)}
          >
            {progress ? progressLabel(progress) : `Translate into ${languages}`}
          </Button>
        </div>
      </section>
      <section
        style={{
          borderTop: '1px solid var(--theme-elevation-100)',
          paddingTop: 'var(--base)',
        }}
      >
        <Button
          buttonStyle='secondary'
          size='small'
          margin={false}
          id='gt-save'
          disabled={busy || Boolean(blocked)}
          onClick={() => void save(route, scope, codes)}
        >
          Save local edits
        </Button>
        <p style={{ margin: 'calc(var(--base) / 2) 0 0', opacity: 0.7 }}>
          Keeps the changes you made to translations when you translate again.
        </p>
      </section>
    </div>
  );
}
