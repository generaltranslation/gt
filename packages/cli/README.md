<p align="center">
  <a href="https://generaltranslation.com" target="_blank">
    <img src="https://generaltranslation.com/gt-logo-light.svg" alt="General Translation" width="100" height="100">
  </a>
</p>

# gtx-cli: General Purpose CLI Tool for General Translation

gtx-cli is a command-line tool used to interface with General Translation's AI-powered i18n platform.

See our [docs](https://generaltranslation.com/docs) for more information including guides, examples, and API references.

## Installation

```bash
npm install gtx-cli
```

## Usage

### Set up

For more details, check out the [setup command documentation](https://generaltranslation.com/docs/cli/setup).

If you are using gt-react or gt-next, run this command to automatically insert `<T>` components into your project.

```bash
npx gtx-cli setup
```

### Init

For more details, check out the [init command documentation](https://generaltranslation.com/docs/cli/init).

This command sets up your `gt.config.json` file.
You will need to run this command in order to run the translate command.

```bash
npx gtx-cli init
```

### Translation

For more details, check out the [translate command documentation](https://generaltranslation.com/docs/cli/translate).

Before deploying to production, you need to generate translations.
First, add your [production api keys](https://generaltranslation.com/dashboard):

```bash
GT_API_KEY=your-production-api-key
GT_PROJECT_ID=your-project-id
```

Next run the translate command.
This will generate translations and either publish them to the CDN or save them in your project depending on your configuration.

```bash
npx gtx-cli translate
```

## Documentation

Full documentation, including guides, examples, and API references, can be found at [General Translation Docs](generaltranslation.com/docs).

## Contributing

We welcome any contributions to our libraries. Please submit a pull request!
