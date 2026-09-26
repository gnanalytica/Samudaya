import { Fraunces, Inter } from 'next/font/google';

/**
 * The app's two faces. Inter for everything read at a glance — labels,
 * buttons, rows — and Fraunces, a soft old-style serif, for the few things
 * that should feel like an occasion: a page's title, an event's name, an
 * amount. A serif is what separates an invitation card from a form.
 *
 * Self-hosted by next/font at build time, so a resident's browser never asks
 * Google for them. Exposed as --font-inter and --font-fraunces on <html>, and
 * read by `font-sans` and `font-serif` (globals.css).
 */
export const sans = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const serif = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  // Optical size: finer at the size of a headline, sturdier at an amount's.
  axes: ['opsz'],
});
