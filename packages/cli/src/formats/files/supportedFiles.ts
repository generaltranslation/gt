export const SUPPORTED_FILE_EXTENSIONS = [
  'json',
  'mdx',
  'md',
  'ts',
  'js',
] as const;

export const FILE_EXT_TO_FORMAT = {
  json: 'JSON',
  mdx: 'MDX',
  md: 'Markdown',
  ts: 'TypeScript',
  js: 'JavaScript',
};
