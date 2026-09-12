import type { MetadataRoute } from 'next';

/**
 * Crawlers may index the public landing and login pages. Everything behind a
 * session is disallowed: it only ever answers a crawler with a redirect to
 * /login, so indexing it would just fill search results with login pages.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/app/', '/api/', '/auth/', '/onboarding'],
    },
  };
}
