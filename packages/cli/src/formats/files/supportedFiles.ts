export const SUPPORTED_FILE_EXTENSIONS = [
  'json',
  'openapi',
  'mdx',
  'md',
  'ts',
  'js',
  'yaml',
  'html',
  'txt',
] as const;

export const FILE_EXT_TO_EXT_LABEL = {
  json: 'JSON',
  openapi: 'OpenAPI',
  mdx: 'MDX',
  md: 'Markdown',
  ts: 'TypeScript',
  js: 'JavaScript',
  yaml: 'YAML',
  html: 'HTML',
  txt: 'Text',
};
