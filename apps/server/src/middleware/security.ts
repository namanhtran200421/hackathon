/**
 * Security headers for every response.
 *
 * The content security policy only lets the page load files from this server:
 * no third-party scripts, fonts or trackers. Inline styles are allowed because
 * the page positions a few elements (map tooltips, legend colours) with style
 * attributes.
 */

import helmet from "helmet";
import type { RequestHandler } from "express";

export function securityHeaders(developmentMode: boolean): RequestHandler {
  if (developmentMode) {
    // Vite's live reloading needs inline scripts, so the policy is off while developing.
    return helmet({ contentSecurityPolicy: false });
  }
  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        workerSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
  });
}
