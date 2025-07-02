# Migrating next-intl Rich Text to gt-next T Component

**Objective**: Convert next-intl `t.rich()` functions to gt-next `T` component with HTML elements.

## Simple Migration Pattern

Replace `t.rich()` with `T` component and convert component mappings to HTML elements.

**Before (next-intl)**:
```tsx
import { useTranslations } from 'next-intl';

export default function Component() {
  const t = useTranslations('common');
  
  return (
    <div>
      {t.rich('message', {
        strong: (chunks) => <strong>{chunks}</strong>,
        link: (chunks) => <a href="/about">{chunks}</a>
      })}
    </div>
  );
}
```

**Translation file**:
```json
{
  "common": {
    "message": "This is <strong>important</strong> text with a <link>link</link>."
  }
}
```

**After (gt-next)**:
```tsx
import { T } from 'gt-next';

export default function Component() {
  return (
    <div>
      <T>
        This is <strong>important</strong> text with a <a href="/about">link</a>.
      </T>
    </div>
  );
}
```

**No translation file needed** - the content is now directly in the component!

## Migration Steps

1. **Remove t.rich()**: Delete the entire `t.rich()` call
2. **Add T component**: Wrap with `<T>content</T>`
3. **Move content**: Take the text from the translation file and put it directly inside `T` with HTML tags
4. **Import T component**: Add `import { T } from 'gt-next';`

## Key Points

- The `T` component handles HTML elements directly
- Move content from translation files into the component
- Convert React component mappings to regular HTML tags
- No more translation file needed for this content

That's it - just put the content directly inside `T` with HTML tags!