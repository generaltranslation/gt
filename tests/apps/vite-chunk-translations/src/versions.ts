import { version } from 'react';

// A module without messages that the app imports dynamically, as an app
// imports a table of its routes: the import of its chunk needs no
// translation file, and the page must say nothing of that. It imports
// another chunk, so the bundler lists what to preload with it.
document.documentElement.dataset.react = version;
