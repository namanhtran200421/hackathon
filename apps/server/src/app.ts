/**
 * The Express app.
 *
 * It does four things:
 *   1. Serves the React web page.
 *   2. Serves the traffic simulation files at /sim. The simulation runs in each
 *      visitor's browser, so the server does no heavy work and needs no database.
 *   3. Answers a small API under /api.
 *   4. Adds security headers and compresses responses so pages load quickly.
 */

import compression from "compression";
import express from "express";
import type { ServerConfig } from "./config.js";
import { alwaysCheckForUpdates } from "./middleware/caching.js";
import { handleErrors, notFound } from "./middleware/errors.js";
import { securityHeaders } from "./middleware/security.js";
import { apiRoutes } from "./routes/api.js";
import { builtPage, developmentPage } from "./routes/webPage.js";

type AppFolders = Pick<ServerConfig, "developmentMode" | "webFolder" | "builtWebFolder" | "simulationFolder">;

export async function createApp(config: AppFolders): Promise<express.Express> {
  const app = express();

  app.disable("x-powered-by");
  app.use(securityHeaders(config.developmentMode));
  app.use(compression());

  app.use("/api", apiRoutes(config.simulationFolder));

  // The simulation engine, model and background worker.
  app.use(
    "/sim",
    express.static(config.simulationFolder, {
      index: false,
      dotfiles: "ignore",
      setHeaders: alwaysCheckForUpdates,
    }),
  );

  if (config.developmentMode) {
    app.use(await developmentPage(config.webFolder));
  } else {
    app.use(builtPage(config.builtWebFolder));
  }

  app.use(notFound);
  app.use(handleErrors);
  return app;
}
