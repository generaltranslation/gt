import { CustomLoader } from "gt-react/internal";
import { unresolvedCustomLoadMessagesError } from "../errors/createErrors";

let customLoadMessages: CustomLoader | undefined = undefined;

export default function resolveMessageLoader(): CustomLoader | undefined {
  // Singleton pattern
  if (customLoadMessages !== undefined) return customLoadMessages;

  // Check: local message loader is enabled
  if (process.env._GENERALTRANSLATION_LOCAL_MESSAGE_ENABLED !== 'true') return;

  // get load messages file
  let customLoadMessagesConfig;
  try {
    customLoadMessagesConfig = require('gt-next/_load-messages');
  } catch { }

  // Get custom loader
  customLoadMessages =
    customLoadMessagesConfig?.default ||
    customLoadMessagesConfig?.getLocalMessages;

  // Check: custom loader is exported
  if (!customLoadMessages) {
    // So the custom loader doesnt eval to falsey
    customLoadMessages = async (_: string) => undefined;

    // Throw error in dev
    if (process.env.NODE_ENV !== 'production') {
      throw new Error(unresolvedCustomLoadMessagesError);
    }

    // Custom loader file was defined but not exported
    console.error(unresolvedCustomLoadMessagesError);
  }

  return customLoadMessages;
}