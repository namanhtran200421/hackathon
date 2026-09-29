/**
 * The security headers every page and file is served with.
 *
 * The site is static: Vercel serves it from its CDN and applies these through
 * vercel.json, and `npm start` (Vite's preview server) applies them from here.
 * test/securityHeaders.test.ts checks that both lists stay the same.
 *
 * The content security policy only lets the page load files from its own
 * address: no third-party scripts, fonts or trackers. Inline styles are
 * allowed because the page positions a few elements (map tooltips, legend
 * colours) with style attributes. Scripts must be files; the built page has
 * no inline scripts.
 */

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "worker-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

export const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": CONTENT_SECURITY_POLICY,
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};
