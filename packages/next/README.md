# gt-next: Automatic i18n for Next.js

gt-next is a powerful internationalization library designed for Next.js applications. It replaces your existing localization library, and integrates with [generaltranslation.com](https://generaltranslation.com) for translations.

## Installation

Install `gt-next` via npm:

```bash
npm install gt-next
```

Or with yarn:

```bash
yarn add gt-next
```

## Getting Started

### Step 1: Configure Your Environment Variables

Add the following environment variables to your `.env` file:

```
GT_API_KEY="your-api-key"
GT_PROJECT_ID="your-project-id"
```

 * Get your `API Key` and `Project ID` from the [General Translation Dashboard](https://www.generaltranslation.com).

### Step 2: Add the `<GTProvider>`

Add the `<GTProvider>` component to add translations for client-side
content, and set the <html> `lang` attribute using `getLocale()`.

```jsx
import { GTProvider } from 'gt-next'
import { getLocale } from 'gt-next/server'
 
export default async function RootLayout({ children }) {

    const lang = await getLocale();

    return (
        <html lang={lang}>
            <body>
                <GTProvider>
                    { children }
                </GTProvider>
            </body>
        </html>
    )
}
```

### Step 3: Translate Content with `<T>`

The `<T>` component is the simplest way to translate inline JSX content.

```jsx
import { T } from 'gt-next';

export default function HomePage() {
    return (
        <T id="greeting">
            <p>Hello, world!</p>
        </T>
    );
}
```


## Documentation

Full documentation, including guides, examples, and API references, can be found at [General Translation Docs](www.generaltranslation.com/docs).
