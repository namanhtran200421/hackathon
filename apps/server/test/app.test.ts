/**
 * Tests for the Express server: security headers, the API, caching and errors.
 *
 * A small stand-in page is used instead of the real build, so these tests do
 * not need `npm run build` first. Run with:  npm test
 */

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "../src/app.js";
import { readConfig } from "../src/config.js";

let server: Server;
let address = "";
let pageFolder = "";

before(async function () {
  pageFolder = fs.mkdtempSync(path.join(os.tmpdir(), "traffic-lab-page-"));
  fs.mkdirSync(path.join(pageFolder, "assets"));
  fs.writeFileSync(path.join(pageFolder, "index.html"), "<!doctype html><title>Test page</title>");
  fs.writeFileSync(path.join(pageFolder, "assets", "index-abc123.js"), "console.log('hello');");

  const config = readConfig([], {});
  const app = await createApp({
    developmentMode: false,
    webFolder: config.webFolder,
    builtWebFolder: pageFolder,
    simulationFolder: config.simulationFolder,
  });
  await new Promise<void>(function (resolve) {
    server = app.listen(0, "127.0.0.1", function () {
      resolve();
    });
  });
  address = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
});

after(function () {
  server.close();
  fs.rmSync(pageFolder, { recursive: true, force: true });
});

test("the page is served with strict security headers", async function () {
  const response = await fetch(address + "/");
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Test page/);

  const policy = response.headers.get("content-security-policy") || "";
  assert.match(policy, /default-src 'self'/);
  assert.match(policy, /script-src 'self'(;|$)/);
  assert.match(policy, /object-src 'none'/);
  assert.match(policy, /frame-ancestors 'none'/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-powered-by"), null);
  assert.equal(response.headers.get("cache-control"), "no-cache");
});

test("the health check and both road maps are available", async function () {
  const health = await fetch(address + "/api/health");
  assert.deepEqual(await health.json(), { status: "ok" });

  for (const name of ["osm", "schematic"]) {
    const response = await fetch(address + "/api/networks/" + name);
    assert.equal(response.status, 200);
    const map = (await response.json()) as { roads: unknown[]; streets: string[] };
    assert.ok(map.roads.length > 100);
    assert.ok(map.streets.includes("Collins St"));
  }
});

test("unknown road maps and addresses are refused", async function () {
  for (const name of ["nope", "__proto__", "constructor", "..%2Fpackage.json"]) {
    const response = await fetch(address + "/api/networks/" + name);
    assert.equal(response.status, 404, name);
  }
  assert.equal((await fetch(address + "/api/anything")).status, 404);
  assert.equal((await fetch(address + "/no-such-page")).status, 404);
});

test("only simulation files are served from /sim", async function () {
  const reporters = await fetch(address + "/sim/reporters.js");
  assert.equal(reporters.status, 200);
  assert.equal(reporters.headers.get("cache-control"), "no-cache");

  // Encoded dots must not escape the folder.
  const escape = await fetch(address + "/sim/..%2F..%2Fpackage.json");
  assert.equal(escape.status, 404);
});

test("large files are compressed and built files are cached for a year", async function () {
  const engine = await fetch(address + "/sim/tortoise-engine.js", {
    headers: { "Accept-Encoding": "gzip" },
  });
  assert.equal(engine.status, 200);
  assert.equal(engine.headers.get("content-encoding"), "gzip");

  const asset = await fetch(address + "/assets/index-abc123.js");
  assert.equal(asset.status, 200);
  assert.equal(asset.headers.get("cache-control"), "public, max-age=31536000, immutable");
  assert.equal((await fetch(address + "/assets/missing.js")).status, 404);
});
