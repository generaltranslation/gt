'use client';

import { useDocsSearch } from 'fumadocs-core/search/client';
import type { StaticOptions } from 'fumadocs-core/search/client';
import { useI18n } from 'fumadocs-ui/contexts/i18n';
import type { SharedProps } from 'fumadocs-ui/components/dialog/search';
import { useRouter } from 'fumadocs-core/framework';
import { useCallback, useMemo, useState, useRef } from 'react';
import { create } from '@orama/orama';
import { createTokenizer as createMandarinTokenizer } from '@orama/tokenizers/mandarin';
import { createTokenizer as createJapaneseTokenizer } from '@orama/tokenizers/japanese';
import { FileText, Hash, AlignLeft, Code2 } from 'lucide-react';

export default function SearchDialog(props: SharedProps) {
  const { locale, text } = useI18n();

  type AnyOramaInstance = Awaited<
    ReturnType<NonNullable<StaticOptions['initOrama']>>
  >;

  const initOrama = useCallback<NonNullable<StaticOptions['initOrama']>>(
    async (loc?: string) => {
      if (loc === 'zh') {
        return (await create({
          schema: { _: 'string' },
          components: { tokenizer: createMandarinTokenizer() },
        })) as unknown as AnyOramaInstance;
      }
      if (loc === 'ja') {
        return (await create({
          schema: { _: 'string' },
          components: { tokenizer: createJapaneseTokenizer() },
        })) as unknown as AnyOramaInstance;
      }
      return (await create({
        schema: { _: 'string' },
      })) as unknown as AnyOramaInstance;
    },
    []
  );

  const clientOptions = useMemo(
    () => ({
      type: 'static' as const,
      from: `/api/search/${locale}`,
      initOrama,
    }),
    [initOrama, locale]
  );

  const { search, setSearch, query } = useDocsSearch(clientOptions);

  const router = useRouter();
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const lastMouseMoveTime = useRef<number>(0);

  const items = useMemo(
    () => (Array.isArray(query.data) ? query.data : []),
    [query.data]
  );

  // Group flat results (page, heading, text) into page groups with nested children
  const groups = useMemo(() => {
    type Group = { page: (typeof items)[number]; children: typeof items };
    const out: Group[] = [];
    let current: Group | null = null;

    for (const it of items) {
      if (it.type === 'page') {
        current = { page: it, children: [] };
        out.push(current);
      } else if (current) {
        current.children.push(it);
      } else {
        // Orphan child so create a synthetic container
        current = { page: { ...it, type: 'page' }, children: [it] } as Group;
        out.push(current);
      }
    }

    return out;
  }, [items]);

  // Flat list of all navigable items for keyboard navigation
  const flatItems = useMemo(() => {
    const flat: Array<{
      type: 'page' | 'child';
      item: (typeof items)[number];
      groupIndex: number;
      childIndex?: number;
    }> = [];
    groups.forEach((group, groupIndex) => {
      flat.push({ type: 'page', item: group.page, groupIndex });
      group.children.forEach((child, childIndex) => {
        flat.push({ type: 'child', item: child, groupIndex, childIndex });
      });
    });
    return flat;
  }, [groups]);

  function isCodeLike(input: string): boolean {
    const s = input.trim();
    if (s.startsWith('```') || s.includes('```')) return true;
    if (s.includes('=>') || /\b(const|let|function|import|export)\b/.test(s))
      return true;
    if (/\{.*\}|\[.*\]/.test(s) && /[:,]/.test(s)) return true; // JSON-ish
    if (/\bSELECT\b|\bFROM\b|\bINSERT\b/i.test(s)) return true; // SQL-ish
    return false;
  }

  if (!props.open) return null;

  return (
    <div>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 backdrop-blur-xs bg-black/30"
        onClick={() => props.onOpenChange(false)}
      />
      <div className="fixed left-1/2 top-8 z-[51] w-[calc(100%-1rem)] max-w-screen-sm -translate-x-1/2 rounded-xl border bg-fd-popover text-fd-popover-foreground shadow-2xl shadow-black/60 overflow-hidden overflow-x-hidden">
        <div
          className={`flex items-center gap-2 p-3 ${groups.length > 0 || (groups.length === 0 && search.trim()) ? 'border-b' : ''}`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="size-5 opacity-70"
          >
            <path d="m21 21-4.3-4.3" />
            <circle cx="11" cy="11" r="8" />
          </svg>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedIndex(-1);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                props.onOpenChange(false);
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                const newIndex = (selectedIndex + 1) % flatItems.length;
                setSelectedIndex(newIndex);
                itemRefs.current[newIndex]?.scrollIntoView({
                  block: 'nearest',
                });
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const newIndex =
                  selectedIndex <= 0 ? flatItems.length - 1 : selectedIndex - 1;
                setSelectedIndex(newIndex);
                itemRefs.current[newIndex]?.scrollIntoView({
                  block: 'nearest',
                });
              } else if (e.key === 'Enter' && selectedIndex >= 0) {
                e.preventDefault();
                const selectedItem = flatItems[selectedIndex];
                if (selectedItem) {
                  router.push(selectedItem.item.url);
                  props.onOpenChange(false);
                }
              }
            }}
            placeholder={text.search}
            className="flex-1 bg-transparent outline-none text-sm placeholder-fd-muted-foreground"
            autoFocus
          />
          <button
            type="button"
            onClick={() => props.onOpenChange(false)}
            className="text-xs font-mono text-fd-muted-foreground border rounded px-2 py-1"
          >
            ESC
          </button>
        </div>
        {(groups.length > 0 || (groups.length === 0 && search.trim())) && (
          <div
            className="p-1 bg-fd-popover overflow-y-auto overflow-x-hidden max-h-[70vh]"
            onMouseMove={() => {
              lastMouseMoveTime.current = Date.now();
            }}
          >
            {groups.length === 0 && search.trim() ? (
              <div className="py-12 text-center text-sm text-neutral-400">
{text.searchNoResult}
              </div>
            ) : (
              groups.map(({ page, children }, groupIndex) => {
                const pageItemIndex = flatItems.findIndex(
                  (item) =>
                    item.type === 'page' && item.groupIndex === groupIndex
                );
                const isPageSelected = selectedIndex === pageItemIndex;

                return (
                  <div
                    key={page.id}
                    className="relative rounded-md bg-fd-popover"
                  >
                    <div className="p-3 pb-0">
                      <button
                        ref={(el) => {
                          itemRefs.current[pageItemIndex] = el;
                        }}
                        type="button"
                        className={`block w-full text-left text-sm rounded-md py-2 px-3 min-w-0 transition-colors cursor-pointer ${
                          isPageSelected
                            ? 'text-fd-accent-foreground bg-fd-accent'
                            : selectedIndex >= 0
                              ? 'text-fd-foreground'
                              : 'text-fd-foreground hover:text-fd-accent-foreground hover:bg-fd-accent'
                        }`}
                        onMouseEnter={() => {
                          if (Date.now() - lastMouseMoveTime.current < 100) {
                            setSelectedIndex(pageItemIndex);
                          }
                        }}
                        onClick={() => {
                          router.push(page.url);
                          props.onOpenChange(false);
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="size-4 shrink-0" />
                          <span className="truncate">{page.content}</span>
                        </div>
                      </button>

                      {children.length > 0 && (
                        <div>
                          {children.map((child, childIndex) => {
                            const childItemIndex = flatItems.findIndex(
                              (item) =>
                                item.type === 'child' &&
                                item.groupIndex === groupIndex &&
                                item.childIndex === childIndex
                            );
                            const isChildSelected =
                              selectedIndex === childItemIndex;

                            const code =
                              child.type !== 'heading' &&
                              isCodeLike(child.content);
                            const Icon =
                              child.type === 'heading'
                                ? Hash
                                : code
                                  ? Code2
                                  : AlignLeft;

                            return (
                              <button
                                ref={(el) => {
                                  itemRefs.current[childItemIndex] = el;
                                }}
                                key={child.id}
                                type="button"
                                className={`group block w-full text-start text-sm rounded-md py-2 px-3 transition-colors cursor-pointer ${
                                  isChildSelected
                                    ? 'text-fd-accent-foreground bg-fd-accent'
                                    : selectedIndex >= 0
                                      ? 'text-fd-foreground'
                                      : 'text-fd-foreground hover:text-fd-accent-foreground hover:bg-fd-accent'
                                }`}
                                onMouseEnter={() => {
                                  if (
                                    Date.now() - lastMouseMoveTime.current <
                                    100
                                  ) {
                                    setSelectedIndex(childItemIndex);
                                  }
                                }}
                                onClick={() => {
                                  router.push(child.url);
                                  props.onOpenChange(false);
                                }}
                              >
                                <div className="flex items-center gap-2 min-w-0 ml-4">
                                  <Icon className="size-3.5 shrink-0" />
                                  <span className="truncate">
                                    {child.content}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
