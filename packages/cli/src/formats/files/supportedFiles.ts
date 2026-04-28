export const SUPPORTED_FILE_EXTENSIONS = [
  'json',
  'pot',
  'mdx',
  'md',
  'ts',
  'js',
  'yaml',
  'html',
  'txt',
  'twilioContentJson',
] as const;

export const FILE_EXT_TO_EXT_LABEL = {
  json: 'JSON',
  pot: 'POT',
  mdx: 'MDX',
  md: 'Markdown',
  ts: 'TypeScript',
  js: 'JavaScript',
  yaml: 'YAML',
  html: 'HTML',
  txt: 'Text',
  twilioContentJson: 'Twilio Content JSON',
};
