// adapted from https://github.com/sanity-io/sanity-translations-tab. See LICENSE.md for more details.

export const checkSerializationVersion = (HTMLdoc: string): string | null => {
  const parser = new DOMParser();
  const node = parser.parseFromString(HTMLdoc, 'text/html');
  const versionMetaTag = Array.from(node.head.children).find(
    (metaTag) => metaTag.getAttribute('name') === 'version'
  );
  if (!versionMetaTag) {
    return null;
  }

  const version = versionMetaTag.getAttribute('content');
  return version;
};
