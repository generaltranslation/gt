# GT-Next: Seamless Internationalization for Next.js

GT-Next is a powerful internationalization library designed for Next.js applications. It allows you to effortlessly translate your app into multiple languages, leveraging cloud-based translation APIs, on demand translations, and global caching.

## Features

- **Inline Translations**: Use the `<T>` component to translate JSX content directly in your components.
- **Dynamic Translation**: Translate content on demand with minimal setup.
- **Template Dictionaries**: Manage translatable content using a scalable dictionary design pattern.
- **Variable Components**: Insert dynamic, untranslatable content like numbers, dates, and currencies with ease.
- **Branching Components**: Handle conditional rendering and pluralization directly in translations.
- **Secure Translation**: Sensitive content remains local and safe.

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
content.
```jsx
import { GTProvider } from 'gt-next'
 
export default function RootLayout({ children }) {
    return (
        <html lang="en">
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
import { MyComponent } from '@components/MyComponent';

export default function HomePage() {
    return (
        <T id="greeting">
            Hello, world!
            <MyComponent>
                This gets translated too!
            </MyComponent>
        </T>
    );
}
```


## Documentation

Full documentation, including guides, examples, and API references, can be found at [General Translation Docs](www.generaltranslation.com/docs).
