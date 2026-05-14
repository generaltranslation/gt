/**
 * Type for custom getLocale function
 */
export type GetLocale = () => string;

/**
 * Html tag options
 * @param {boolean} updateHtmlLangTag - Whether to update the html lang tag on locale change
 * @param {boolean} updateHtmlDirTag - Whether to update the html dir tag on locale change
 */
export type HtmlTagOptions = {
  updateHtmlLangTag?: boolean;
  updateHtmlDirTag?: boolean;
};
