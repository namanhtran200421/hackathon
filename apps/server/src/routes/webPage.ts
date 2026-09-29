/**
 * Serving the React page: through Vite while developing, or the built files
 * in production.
 */

import fs from "node:fs";
import path from "node:path";
import express, { Router } from "express";
import { alwaysCheckForUpdates, cacheForAYear } from "../middleware/caching.js";

/** Vite with live reloading. Only loaded in development mode. */
export async function developmentPage(webFolder: string): Promise<express.RequestHandler> {
  const { createServer } = await import("vite");
  const vite = await createServer({
    root: webFolder,
    server: { middlewareMode: true },
    appType: "spa",
  });
  return vite.middlewares;
}

/** The built page from `npm run build`. */
export function builtPage(builtWebFolder: string): Router {
  if (!fs.existsSync(path.join(builtWebFolder, "index.html"))) {
    throw new Error("The web page has not been built yet. Run `npm run build` first.");
  }
  const router = Router();

  router.use(
    "/assets",
    express.static(path.join(builtWebFolder, "assets"), {
      index: false,
      fallthrough: false,
      setHeaders: cacheForAYear,
    }),
  );

  router.get("/", function (_request, response) {
    alwaysCheckForUpdates(response);
    response.sendFile(path.join(builtWebFolder, "index.html"));
  });

  router.use(
    express.static(builtWebFolder, {
      index: false,
      dotfiles: "ignore",
      setHeaders: alwaysCheckForUpdates,
    }),
  );

  return router;
}
