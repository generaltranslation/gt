/** @type {import('next-sitemap').IConfig} */
const config = {
  siteUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://generaltranslation.com',
  generateRobotsTxt: false,
  generateIndexSitemap: false,
  outDir: './public',
  sitemapBaseFileName: 'docs-sitemap',
  exclude: ['/api/*', '*/404', '*/500'],
  
  // Only include English pages in the sitemap
  transform: async (config, path) => {
    // Extract locale from path
    const localeMatch = path.match(/^\/([a-z]{2})(\/|$)/);
    const locale = localeMatch ? localeMatch[1] : 'en';
    
    // Skip non-English pages (they'll be referenced as alternates)
    if (locale !== 'en') {
      return null;
    }
    
    // Get the content path without the locale prefix
    let pathWithoutLocale = path;
    if (localeMatch) {
      // If there's a locale prefix, remove it
      pathWithoutLocale = path.substring(localeMatch[0].length - (localeMatch[2] === '/' ? 1 : 0));
      // Ensure pathWithoutLocale starts with a slash
      if (!pathWithoutLocale.startsWith('/')) {
        pathWithoutLocale = '/' + pathWithoutLocale;
      }
    }
    
    // Generate alternate URLs for all languages
    const supportedLocales = ['zh', 'de', 'fr', 'es', 'ja'];
    const alternateRefs = [];
    
    // Add each language variant with the correct language prefix
    for (const lang of supportedLocales) {
      alternateRefs.push({
        href: `${config.siteUrl}/${lang}${pathWithoutLocale}`,
        hreflang: lang,
        hrefIsAbsolute: true,
      });
    }
    
    // Add x-default (points to English)
    alternateRefs.push({
      href: `${config.siteUrl}/en${pathWithoutLocale}`,
      hreflang: 'x-default',
      hrefIsAbsolute: true,
    });

    // Use current date for lastmod
    const currentDate = new Date().toISOString();

    return {
      loc: `${config.siteUrl}${path}`,
      changefreq: 'daily',
      priority: 0.7,
      lastmod: currentDate,
      alternateRefs,
    };
  },
};

export default config;
