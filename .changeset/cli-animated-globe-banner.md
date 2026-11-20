---
'gt': minor
---

The startup banner is the new General Translation globe, animated. In an interactive terminal it turns into place as a lit armillary sphere and keeps turning while the command works, showing its progress on a status line under the globe; it lands on the logo before any prompt, warning or error, when the command finishes, or after 10 seconds, and the command's output follows in order. The animation never makes a command slower.

Everywhere else the banner is the still globe: when output is not a terminal, in CI, with `TERM=dumb`, in windows of 30 rows or fewer, or when motion is turned off. Turn it off for one run with `--no-animation`, for a shell with `GT_NO_ANIMATION=1` or `REDUCE_MOTION=1`, or for good with `{ "animation": false }` in `~/.config/gt/config.json` (or `$XDG_CONFIG_HOME/gt/config.json`). The banner also stays still when `NO_COLOR` is set (uncolored) or the system's Reduce Motion setting is on (macOS and GNOME), and shows only the text header in windows narrower than 52 columns.
