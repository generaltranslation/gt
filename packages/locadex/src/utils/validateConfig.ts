import { logger } from '../logging/logger.js';

export function validateInitialConfig() {
  // Validate ANTHROPIC_API_KEY
  if (!process.env.ANTHROPIC_API_KEY) {
    logger.error(
      'ANTHROPIC_API_KEY is not set! Please set it as an environment variable or in a .env | .env.local file.'
    );
    process.exit(1);
  }
}
