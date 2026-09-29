import fs from "node:fs";
import { format } from "prettier";
const source = fs.readFileSync("DESIGN.md", "utf8").split("---")[1];
function section(name, next) {
  return source.split(`${name}:\n`)[1].split(`${next}:\n`)[0];
}
function pairs(text) {
  return Object.fromEntries(
    [...text.matchAll(/^  ([\w-]+): ["']([^"']+)["']/gm)].map(
      ([, name, value]) => [name, value],
    ),
  );
}
const colors = pairs(section("colors", "typography"));
const typography = Object.fromEntries(
  [
    ...section("typography", "rounded").matchAll(
      /^  (\w+):\n    fontFamily: ["']([^"']+)["']/gm,
    ),
  ].map(([, name, value]) => [name, value]),
);
const radius = pairs(section("rounded", "spacing")),
  spacing = pairs(section("spacing", "components"));
if (
  Object.keys(colors).length < 8 ||
  !typography.sans ||
  !radius.DEFAULT ||
  !spacing.panel
)
  throw new Error("DESIGN.md tokens are incomplete.");
const tokens = {
  ...colors,
  "font-display": typography.display,
  "font-body": typography.sans,
  "font-mono": typography.mono,
  radius: radius.DEFAULT,
  "radius-sm": radius.sm,
  space: spacing.unit,
  "panel-space": spacing.panel,
};
const css = `/* Generated from DESIGN.md by scripts/design-tokens.mjs. */\n:root {\n${Object.entries(
  tokens,
)
  .map(([k, v]) => `--${k}: ${v};`)
  .join("\n")}\n}`;
const output = await format(css, { parser: "css" });
if (process.argv.includes("--check")) {
  if (fs.readFileSync("src/app/tokens.css", "utf8") !== output)
    throw new Error(
      "Design tokens drifted; run node scripts/design-tokens.mjs.",
    );
} else fs.writeFileSync("src/app/tokens.css", output);
