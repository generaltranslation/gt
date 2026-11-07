import { msg } from 'gt-next';

// msg() strings are never embedded at their call sites. For the embedded fr
// locale they load from translations/fr.msg.json (see loadTranslations.ts).
export const greeting = msg('Message greeting');

export const steps = [msg('First step'), msg('Second step')];
