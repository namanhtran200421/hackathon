/**
 * The API: a health check and the two road maps.
 */

import path from "node:path";
import { Router } from "express";

/** The only road maps the API will return. */
const ROAD_MAPS: Record<string, string> = {
  osm: "network-osm.json",
  schematic: "network-schematic.json",
};

export function apiRoutes(simulationFolder: string): Router {
  const router = Router();

  // A quick way for hosting services to check that the server is up.
  router.get("/health", function (_request, response) {
    response.json({ status: "ok" });
  });

  // The road maps the page draws while the simulation starts.
  router.get("/networks/:name", function (request, response) {
    const name = request.params.name;
    if (!Object.hasOwn(ROAD_MAPS, name)) {
      response.status(404).json({ error: "There is no road map with that name." });
      return;
    }
    response.setHeader("Cache-Control", "public, max-age=3600");
    response.sendFile(path.join(simulationFolder, ROAD_MAPS[name]));
  });

  // Any other API address does not exist.
  router.use(function (_request, response) {
    response.status(404).json({ error: "Not found." });
  });

  return router;
}
