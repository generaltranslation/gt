/** @type {import('next-sitemap').IConfig} */
const config = {
  siteUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://generaltranslation.com',
  generateRobotsTxt: false,
  generateIndexSitemap: false,
  outDir: './public',
  sitemapBaseFileName: 'docs-sitemap',
  exclude: ['*/api/*', '*/404', '*/500'],
  transform: async (config, path) => {
    // Custom priority and changefreq for specific paths
    if (path.includes('/docs/getting-started')) {
      return {
        loc: path,
        changefreq: 'weekly',
        priority: 0.8,
        lastmod: new Date().toISOString(),
      };
    }
    
    return {
      loc: path,
      changefreq: 'daily',
      priority: 0.7,
      lastmod: new Date().toISOString(),
    };
  },
};

export default config;
