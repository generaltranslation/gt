const { showIncompatiblePluginDialog } = require('@sanity/incompatible-plugin');
const { name, version, sanityExchangeUrl } = require('./package.json');

module.exports = showIncompatiblePluginDialog({
  name,
  versions: {
    v3: version,
    v2: undefined,
  },
  sanityExchangeUrl,
});
