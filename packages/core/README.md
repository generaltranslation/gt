<p align="center">
  <a href="https://generaltranslation.com" target="_blank">
    <img src="https://generaltranslation.com/gt-logo-light.svg" alt="General Translation" width="100" height="100">
  </a>
</p>

# General Translation

This is the core library for General Translation. It is used in `gt-react` and `gt-next`.

See our [docs](https://generaltranslation.com/docs) for more information including guides, examples, and API references.

## Development

### Prerequisites

- Node.js (>= 16.0.0)
- npm or yarn

### Installation

```bash
npm install
```

## Testing

This project uses [Vitest](https://vitest.dev/) for testing with two types of tests:

### Test Types

- **Unit Tests** (`__tests__/`): Fast, isolated tests with mocking

### Running Tests

```bash
# Run all tests (unit + e2e)
npm test

# Run only unit tests
npm test -- __tests__

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- __tests__/logging/logger.test.ts

# Run tests matching a pattern
npm test -- -t "should handle translation"
```

### Environment Variables

#### Required for E2E Tests

Create a `.env` file in the project root with:

```bash
# GT API Configuration
VITE_GT_API_KEY="your-dev-api-key"
VITE_GT_PROJECT_ID="your-project-id"
VITE_GT_RUNTIME_URL="http://localhost:10000"
```

> **Note**: E2E tests require a running GT runtime server at the specified URL. Without proper configuration, e2e tests will skip gracefully.

#### Optional: Logger Configuration

```bash
# Set logging level for development/debugging
_GT_LOG_LEVEL=debug  # Options: debug, info, warn, error (default: warn)
```

### Test Configuration

- **Parallel Execution**: Tests run in parallel using 2-4 threads for optimal performance
- **Timeout**: 15 seconds per test (suitable for network-dependent e2e tests)
- **Environment**: Node.js environment for testing

### Example Test Commands

```bash
# Development workflow
_GT_LOG_LEVEL=debug npm test --reporter=verbose

# Quick unit test validation
npm test -- __tests__

# Test specific functionality
npm test -- -t "logger" --reporter=verbose

# Watch mode for development
npm run test:watch -- __tests__/
```

### Test Structure

```
__tests__/           # Unit tests with mocking
├── logging/         # Logger functionality tests
└── translate/       # Translation logic tests
```

## Contributing

We welcome any contributions to our libraries. Please submit a pull request!

### Development Workflow

1. Install dependencies: `npm install`
2. Set up environment variables (see Testing section)
3. Run tests: `npm test`
4. Make your changes
5. Run tests again to ensure everything works
6. Submit a pull request
