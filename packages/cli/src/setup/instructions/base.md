### Workflow

1. Configure translation file patterns in `gt.config.json`.
2. Run `npx gtx-cli translate` to translate files.

### Config (`gt.config.json`)

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

- Use `[locale]` as a placeholder in file path patterns. It will be replaced with each target locale.
- See https://generaltranslation.com/docs/cli/reference/config for all options.

### Translating

Run `npx gtx-cli translate` to translate the project.

### Docs

https://generaltranslation.com/llms.txt
