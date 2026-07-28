// Module-level t`...` resolves once, when this module is first evaluated. It loads
// from a route, after initializeGTSPA() has completed, so translations are ready.
// gt-react reloads the page on locale change, which re-evaluates this module.
export const moduleLevelHeading = t`This sentence is produced by a t() call at the top level of a module.`;
