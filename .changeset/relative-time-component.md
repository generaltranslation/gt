---
'generaltranslation': minor
'@generaltranslation/react-core': minor
'gt-react': minor
'gt-next': minor
'gt-tanstack-start': minor
---

Add `<RelativeTime>` component for localized relative time formatting

- New `<RelativeTime>` component with two usage modes:
  - Auto-select unit from a Date: `<RelativeTime>{someDate}</RelativeTime>` → "2 hours ago"
  - Explicit value + unit: `<RelativeTime value={-1} unit="day" />` → "yesterday"
- Core: `_selectRelativeTimeUnit()` auto-selects the best unit (seconds → minutes → hours → days → weeks → months → years)
- Core: `formatRelativeTimeFromDate()` standalone function and `GT.formatRelativeTimeFromDate()` class method
- Week unit included in auto-selection thresholds (7-27 days)
