/**
 * Cache rules for static files.
 */

import type { Response } from "express";

/** Browsers check with the server before reusing these files, so updates show up at once. */
export function alwaysCheckForUpdates(response: Response): void {
  response.setHeader("Cache-Control", "no-cache");
}

/** Built files have a content hash in their names, so they can be cached for a year. */
export function cacheForAYear(response: Response): void {
  response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
}
