# GT Next.js SSG Example

This example demonstrates how to set up Static Site Generation (SSG) with [gt-next](https://github.com/gregives/gt) for internationalized Next.js applications.

## Features

- 🚀 **Static Site Generation** - Pre-renders pages at build time for optimal performance
- 🌍 **Internationalization** - Generates static pages for multiple locales
- 🎯 **App Router** - Uses Next.js App Router with middleware routing
- 📦 **GT Integration** - Seamless integration with gt-next for translations

## Getting Started

### Prerequisites

- Node.js 18+
- Next.js 15.1+ (required for SSG support)

### Installation

#### 1. Clone and install dependencies

```bash
npm install
```

#### 2. Generate translations (optional - example translations included)

```bash
npx gtx-cli translate
```

#### 3. Build the project to generate static pages

```bash
npm run build
```

#### 4. Start the production server

```bash
npm start
```

Or run in development mode:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the result.

## Project Structure

```text
src/
├── app/
│   └── [locale]/          # Localized pages
│       ├── layout.tsx     # Layout component  
│       └── page.tsx       # Homepage with generateStaticParams
├── i18n/
│   ├── getLocale.ts       # Locale detection for SSG
│   ├── getRegion.ts       # Region detection (disabled for SSG)
│   └── loadTranslations.ts # Translation loader
proxy.ts                   # Middleware for locale routing
next.config.ts             # GT configuration
```

## Key Configuration

This example follows the [GT SSG documentation](https://generaltranslation.com/en-US/docs/next/guides/ssg) and includes:

1. **Middleware routing** (`proxy.ts`) - Handles locale detection for dynamic requests
2. **Custom locale detection** (`src/i18n/getLocale.ts`) - Uses Next.js 15.5+ `locale()` function
3. **Disabled region detection** (`src/i18n/getRegion.ts`) - Returns `undefined` for static rendering
4. **generateStaticParams** (`src/app/[locale]/page.tsx`) - Generates static parameters for each locale

## Learn More

- [GT Next.js SSG Guide](https://generaltranslation.com/en-US/docs/next/guides/ssg) - Complete SSG setup documentation
- [GT Next.js Documentation](https://generaltranslation.com/en-US/docs/next) - Full gt-next documentation
- [Next.js SSG Documentation](https://nextjs.org/docs/app/building-your-application/rendering/static-and-dynamic#static-rendering-default) - Next.js static generation guide
