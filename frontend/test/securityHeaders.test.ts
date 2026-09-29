/**
 * The security headers are written twice: in vite/securityHeaders.ts for the
 * local preview server, and in vercel.json for Vercel. This checks they match.
 *
 * Run with:  npm test
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { SECURITY_HEADERS } from "../vite/securityHeaders.ts";

interface VercelHeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}

const vercelFile = path.join(import.meta.dirname, "..", "..", "vercel.json");
const vercel = JSON.parse(fs.readFileSync(vercelFile, "utf8")) as { headers: VercelHeaderRule[] };

test("vercel.json sends the same security headers as the preview server", function () {
  const everyPage = vercel.headers.find(function (rule) {
    return rule.source === "/(.*)";
  });
  assert.ok(everyPage, "vercel.json needs a header rule for every page");
  const sent: Record<string, string> = {};
  everyPage.headers.forEach(function (header) {
    sent[header.key] = header.value;
  });
  assert.deepEqual(sent, SECURITY_HEADERS);
});

test("the content security policy only allows this site's own files", function () {
  const policy = SECURITY_HEADERS["Content-Security-Policy"];
  assert.match(policy, /default-src 'self'/);
  assert.match(policy, /script-src 'self'(;|$)/);
  assert.match(policy, /object-src 'none'/);
  assert.match(policy, /frame-ancestors 'none'/);
  assert.doesNotMatch(policy, /unsafe-eval/);
});
