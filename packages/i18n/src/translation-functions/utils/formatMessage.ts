import logger from '../../logs/logger';
import { interpolationFailureMessage } from './messages';
import { formatMessage as _formatMessage } from 'generaltranslation';

/**
 * Given an encoded message and variables, formats the message.
 * On error, the original encoded message is returned with a warning.
 * @param encodedMsg
 * @param variables
 * @returns
 */
export function formatMessage(
  encodedMsg: string,
  variables: Record<string, string>
): string {
  try {
    return _formatMessage(encodedMsg, { variables });
  } catch (error) {
    logger.warn(interpolationFailureMessage + ' Error: ' + error);
    return encodedMsg;
  }
}
