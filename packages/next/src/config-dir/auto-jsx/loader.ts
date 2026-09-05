import { autoJsxLayerLoader } from './layerLoader';

// loader-runner requires a CommonJS callable. Keep the testable implementation
// named, and always register the emitted .js adapter rather than its ESM build.
module.exports = autoJsxLayerLoader;
