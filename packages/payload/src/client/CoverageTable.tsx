'use client';
import { theme } from './theme';
import { Pagination, Pill, useConfig } from '@payloadcms/ui';
import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import type { CoveragePage, LocaleCoverage } from '../coverage';
import { targetKey } from '../targets';
import type { TranslateTarget } from '../types';
import { apiRoute, coverage } from './api';
import { useLocaleOptions } from './locales';

const PAGE_LIMIT = 25;

const CELL: Record<
  LocaleCoverage,
  { text: string; title: string; color: string }
> = {
  complete: {
    text: '✓',
    title: 'Translated',
    color: theme.success,
  },
  partial: {
    text: 'Partly',
    title: 'Partly translated',
    color: theme.warning,
  },
  empty: {
    text: '—',
    title: 'Not translated',
    color: theme.muted,
  },
};

function editUrl(
  adminRoute: string,
  target: TranslateTarget,
  locale: string
): string {
  const path =
    'global' in target
      ? `/globals/${target.global}`
      : `/collections/${target.collection}/${target.id}`;
  return `${adminRoute}${path}?locale=${encodeURIComponent(locale)}`;
}

const cellStyle = {
  padding: `calc(${theme.base} / 2)`,
  borderBottom: `1px solid ${theme.border}`,
  whiteSpace: 'nowrap',
} as const;

// Every document with the languages it has text in. Reloads when reloadKey
// changes.
export function CoverageTable({ reloadKey }: { reloadKey: number }) {
  const { config } = useConfig();
  const route = apiRoute(config);
  const options = useLocaleOptions().filter((o) => o.supported);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<CoveragePage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    coverage(route, page, PAGE_LIMIT).then(
      (loaded) => {
        if (!active) return;
        setData(loaded);
        setError(null);
      },
      (caught: unknown) => {
        if (active)
          setError(caught instanceof Error ? caught.message : String(caught));
      }
    );
    return () => {
      active = false;
    };
  }, [route, page, reloadKey]);

  if (error)
    return (
      <p style={{ color: theme.error }}>Couldn't load your content. {error}</p>
    );
  if (!data) return <p style={{ opacity: 0.6 }}>Loading…</p>;

  return (
    <section
      data-testid='gt-coverage'
      style={{ display: 'grid', gap: theme.base }}
    >
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...cellStyle, textAlign: 'left' }}>Content</th>
              {options.map((option) => (
                <th
                  key={option.code}
                  style={{ ...cellStyle, textAlign: 'center' }}
                >
                  {option.emoji} {option.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.documents.map((document) => {
              const key = targetKey(document.target);
              const empty = Object.keys(document.locales).length === 0;
              return (
                <tr key={key}>
                  <td style={cellStyle}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: `calc(${theme.base} / 2)`,
                      }}
                    >
                      <Link
                        href={editUrl(
                          config.routes.admin,
                          document.target,
                          config.localization
                            ? config.localization.defaultLocale
                            : ''
                        )}
                      >
                        {document.title}
                      </Link>
                      <Pill size='small' pillStyle='light-gray'>
                        {document.label}
                      </Pill>
                    </span>
                  </td>
                  {empty ? (
                    <td
                      colSpan={options.length}
                      style={{
                        ...cellStyle,
                        textAlign: 'center',
                        opacity: 0.6,
                      }}
                    >
                      Nothing to translate yet
                    </td>
                  ) : (
                    options.map((option) => {
                      const status = document.locales[option.code];
                      const cell = status ? CELL[status] : CELL.empty;
                      return (
                        <td
                          key={option.code}
                          style={{ ...cellStyle, textAlign: 'center' }}
                        >
                          <Link
                            href={editUrl(
                              config.routes.admin,
                              document.target,
                              option.code
                            )}
                            title={`${cell.title} – open in ${option.name}`}
                            data-testid={`gt-coverage-${key}-${option.code}`}
                            style={{
                              color: cell.color,
                              textDecoration: 'none',
                              fontWeight: 600,
                            }}
                          >
                            {cell.text}
                          </Link>
                        </td>
                      );
                    })
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {data.totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={data.totalPages}
          hasNextPage={page < data.totalPages}
          hasPrevPage={page > 1}
          nextPage={page + 1}
          prevPage={page - 1}
          onChange={setPage}
        />
      )}
    </section>
  );
}
