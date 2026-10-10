'use client';
import { Button, CheckboxInput } from '@payloadcms/ui';
import React from 'react';
import type { LocaleOption } from './locales';

// Checkboxes for the locales to translate into, with select all. Locales GT
// cannot translate into are shown but cannot be picked.
export function LocalePicker({
  options,
  selected,
  onChange,
  disabled,
}: {
  options: LocaleOption[];
  selected: string[];
  onChange: (codes: string[]) => void;
  disabled?: boolean;
}) {
  const available = options.filter((o) => o.supported).map((o) => o.code);
  const allSelected =
    available.length > 0 && selected.length === available.length;
  return (
    <div data-testid='gt-locale-picker'>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h4 style={{ margin: 0 }}>Languages</h4>
        <Button
          buttonStyle='subtle'
          size='small'
          margin={false}
          disabled={disabled}
          onClick={() => onChange(allSelected ? [] : available)}
        >
          {allSelected ? 'Clear' : 'Select all'}
        </Button>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 'calc(var(--base) / 4)',
          marginTop: 'calc(var(--base) / 2)',
        }}
      >
        {options.map((option) => (
          <CheckboxInput
            key={option.code}
            id={`gt-locale-${option.code}`}
            checked={option.supported && selected.includes(option.code)}
            label={
              option.supported
                ? `${option.emoji} ${option.name} (${option.code})`
                : `${option.name} (${option.code}) · Not available`
            }
            readOnly={disabled || !option.supported}
            onToggle={(event) =>
              onChange(
                event.target.checked
                  ? [...selected, option.code]
                  : selected.filter((c) => c !== option.code)
              )
            }
          />
        ))}
      </div>
    </div>
  );
}
