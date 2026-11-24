import {
  formatIntlMessage,
  type IntlMessageOptions,
} from './formatIntlMessage';
import { LocaleIntl } from './LocaleIntl';

/** LocaleIntl, and ICU message strings with formatMessage(). */
export class GTIntl extends LocaleIntl {
  formatMessage(message: string, options?: IntlMessageOptions): string {
    return formatIntlMessage(this, message, options);
  }
}
