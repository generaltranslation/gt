// Payload v4 uses semantic design tokens; v3 uses --base and --theme-*.
// Keep fallbacks local to our styles so drawers and pages work independently
// without redefining Payload's global theme. Final values cover absent tokens.
export const theme = {
  base: 'var(--spacer-4, var(--base, 1.5rem))',
  border: 'var(--color-border, var(--theme-elevation-100, currentColor))',
  success: 'var(--color-text-success, var(--theme-success-500, currentColor))',
  warning: 'var(--color-text-warning, var(--theme-warning-500, currentColor))',
  error: 'var(--color-text-danger, var(--theme-error-500, currentColor))',
  muted: 'var(--color-text-tertiary, var(--theme-elevation-400, currentColor))',
} as const;

// Our panel layout uses fixed CSS pixel spacing, independent of each Payload
// major's spacing scale. Colors and native controls still follow its theme.
export const panelSpacing = {
  inset: 16,
  section: 12,
  control: 8,
  label: 4,
} as const;
