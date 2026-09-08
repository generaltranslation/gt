---
'gt': patch
---

fix(cli): wrap headings with author-written `{#id}` anchors in a `<div id>` like every other heading when `experimentalAddHeaderAnchorIds` is `mintlify`. Re-attaching the inline `{#id}` broke Mintlify builds when the heading sat inside nested JSX, because the MDX serializer indents it four spaces and Mintlify no longer recognizes the anchor there.
