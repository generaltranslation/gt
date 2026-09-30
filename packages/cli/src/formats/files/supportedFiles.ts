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
  'lottie',
  'dotStrings',
  'dotStringsdict',
  'androidStrings',
  'xcstrings',
  'srt',
  'resx',
] as const;

/** The formats setup offers: an intentional subset of the supported ones. */
export const SETUP_FILE_FORMATS = [
  'json',
  'md',
  'mdx',
  'ts',
  'js',
  'yaml',
] as const satisfies readonly (typeof SUPPORTED_FILE_EXTENSIONS)[number][];
export type SetupFileFormat = (typeof SETUP_FILE_FORMATS)[number];

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
  lottie: 'Lottie',
  dotStrings: '.strings',
  dotStringsdict: '.stringsdict',
  androidStrings: 'Android strings.xml',
  xcstrings: '.xcstrings',
  srt: 'SubRip subtitles (.srt)',
  resx: '.NET resources (.resx)',
};
