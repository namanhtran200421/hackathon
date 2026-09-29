/**
 * Start the web server.
 *
 *   npm run dev    development mode, with live reloading of the page
 *   npm start      production mode, serving the built page (run `npm run build` first)
 *
 * The port comes from the PORT environment variable, or 3000.
 */

import { createApp } from "./app.js";
import { readConfig } from "./config.js";

const config = readConfig(process.argv, process.env);
const app = await createApp(config);

const server = app.listen(config.port, function () {
  let mode = "production";
  if (config.developmentMode) {
    mode = "development";
  }
  console.log("Melbourne Traffic Lab is running in " + mode + " mode at http://localhost:" + config.port);
});

/** Finish open requests, then exit, when the host asks the server to stop. */
function shutDown(): void {
  server.close(function () {
    process.exit(0);
  });
}

process.on("SIGTERM", shutDown);
process.on("SIGINT", shutDown);
