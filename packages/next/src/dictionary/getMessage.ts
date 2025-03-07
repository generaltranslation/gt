// import { dictionaryNotFoundWarning } from '../errors/createErrors';

// // { [locale]: { [key]: value } }
// let messages: Record<string, Record<string, string>> | undefined = undefined;

// export default function getMessages(locale: string): Record<string, string> | undefined {
//   if (!!messages && !!messages[locale]) return messages[locale];
//   if (!process.env._GENERALTRANSLATION_MESSAGES) return undefined;

//   try {
//       dictionary = require('gt-next/_dictionary');
//   } catch {
//     if (dictionaryFileType) {
//       console.warn(dictionaryNotFoundWarning);
//     }
//     dictionary = {};
//   }
//   return dictionary;
// }