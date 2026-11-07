import { msg } from 'gt-next';

// Only a server page imports this module, so the client resolves it from the
// translations snapshot GTProvider sends
export const serverGreeting = msg('Server greeting');
