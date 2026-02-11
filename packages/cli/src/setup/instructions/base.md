## General Translation (GT) Internationalization Rules

This project is using [General Translation](https://generaltranslation.com/docs/overview.md) for internationalization (i18n) and translations. General Translation is a developer-friendly localization stack, built to ship multilingual apps from end-to-end with ease.

### Configuration

The General Translation configuration file is called `gt.config.json`. It is usually located in the root or src directory of a project.

```json
{
  "defaultLocale": "en",
  "locales": ["es", "fr", "de"],
  "files": {
    "json": {
      "include": ["./**/[locale]/*.json"]
    }
  }
}
```

The API reference for the config file can be found at https://generaltranslation.com/docs/cli/reference/config.md.

### Translation

Run `npx gtx-cli translate` to create translation files for your project. You must have an API key to do this.

### Documentation 

https://generaltranslation.com/llms.txt