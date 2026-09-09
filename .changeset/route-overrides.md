---
'gt-next': minor
---

Add locale-specific page overrides through `override: true` in `pathConfig`, optionally combined with localized paths.

- Override entries are keyed by shared paths, so a French override for `/proj/[id]` renders `app/[locale]/fr/proj/[id]/page.tsx`, even when its public path is localized.
- When using `revalidatePath`, pass the internal rewrite destination rather than the public URL.
- `useSelectedLayoutSegments` reflects the internal route structure, including the override's locale directory when called from the `[locale]` layout.
- On Next.js 16.3.x, prefetching links whose URLs redirect can cause repeated requests; [upstream reports a fix in 16.4.0-canary.6](https://github.com/vercel/next.js/issues/97329#issuecomment-5515713671), which has not yet been verified against the gt-next reproduction.
