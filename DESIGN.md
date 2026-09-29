---
version: alpha
name: Melbourne Traffic Lab
description: A map-first workbench for testing Melbourne street closures.
colors:
  primary: "#111111"
  accent: "#FED203"
  background: "#F4F4F4"
  surface: "#FFFFFF"
  ink: "#111111"
  muted: "#555555"
  border: "#D6D6D6"
  warning: "#B35C00"
  danger: "#E0240B"
typography:
  display:
    fontFamily: "var(--font-heading), Open Sans, Arial, sans-serif"
  sans:
    fontFamily: "Arial, Helvetica, sans-serif"
  mono:
    fontFamily: "ui-monospace, monospace"
rounded:
  DEFAULT: "0"
  sm: "0"
spacing:
  unit: "0.25rem"
  panel: "1.5rem"
components:
  button: {}
  field: {}
  map: {}
---

# Melbourne Traffic Lab

## Overview

A practical traffic workbench for the Melbourne hackathon team. The single job is to configure a scenario, run the existing NetLogo model live, and compare a closure with an open-road baseline. English (Australia), desktop first with a stacked mobile layout. Domain constraints come from combined/README.md: real OSM geometry, illustrative demand and signals, no calibrated predictions.

Signature: the language of Australian traffic-management equipment. Safety yellow, black and light grey, square corners, bold tightly tracked headings. A black utility bar sits above a yellow header whose black pentagon plate carries the name, like a road sign hanging below the bar. Figures sit on yellow tiles with black line icons. The map itself stays calm and pale so traffic reads clearly.

This file generates color, font, radius and spacing tokens via scripts/design-tokens.mjs into src/app/tokens.css. Global CSS and the map consume these tokens. UI behavior lives in UX-CONTRACT.md.

## Colors

Safety yellow (accent) marks the header, primary actions (Go, Apply closure), figure tiles and the selected street on the map. Black carries text, the utility bar, the map toolbar, the run bar, the output log and the footer. Light grey is the page background; white panels hold controls. On the map, moving cars are black, slow cars amber and stopped cars red. Congestion runs from grey through yellow and orange to a dark red for jammed roads. Volume is a grey-to-black ramp. Change vs baseline uses orange for more traffic and blue for less. Plum marks a closed lane. Red dashes mark closed roads; red text marks errors. Never put white text on yellow. Light theme only; forced-colors uses system values.

## Typography

Open Sans (self-hosted with next/font) at 700–800 with negative letter-spacing owns headings, navigation, tile figures and group titles. Navigation and group titles are uppercase. Arial owns labels and prose. Monospace owns the clock, coordinates and model output. Numeric readouts use tabular figures. Minimum body size 14px; small help text 11px in the muted grey.

## Layout

Utility bar, yellow header with section links, then a grey hero band with a faint diagonal hazard texture, a headline and two actions. Below it, a 300–330px model-controls panel sits beside the map. A black toolbar tops the map and a black run bar (Setup, Go, Step, speed, Run forever, clock) closes it. Yellow figure tiles, the baseline comparison and the black output log follow. A black footer with a yellow top rule ends the page. Below 900px the map comes first, the controls stack beneath and the header keeps only Quick guide. No horizontal document overflow.

## Elevation & Depth

Flat. Contrast comes from black and yellow blocks, not shadows. Only the quick-guide sheet casts a shadow.

## Shapes

Square corners everywhere, including buttons, fields, tiles and switches. The brand plate is the only angled shape. Map lines have round ends. Status indicators pair a shape with text.

## Components

Buttons: primary is yellow with black text; secondary is white with a black border that fills black on hover; on black bars secondary buttons are outlined white. A visible 3px focus ring (black on light surfaces, yellow on dark) and 44px minimum targets are consistent. Switches are native checkboxes with role switch, drawn as a square track and thumb. A small yellow Setup tag marks controls that apply only after Setup. Lucide icons use 18px strokes with text or accessible names.

Native selects and range inputs are canonical. All fields have labels and errors preserve values. A persistent role=status region announces lifecycle messages. No alert, confirm or prompt; the Quick guide is a native dialog shown as a right-hand sheet with a yellow header.

Animation interpolates between actual model ticks; it never fabricates traffic. Reduced motion disables transitions and shows each tick without interpolation. Ctrl + scroll or the zoom buttons zoom the map; drag pans when zoomed. Road state has a text legend; closed streets also use dashed strokes and are listed in text. Figures and the downloadable CSV provide nonvisual results.

## Do's and Don'ts

- Use the real road geometry and engine statistics.
- State synthetic traffic assumptions near the map and in the guide.
- Keep red for closures, stopped cars and failures.
- Use our own name and mark; borrow the visual language, not another company's brand.
- Do not label an incomplete run as a completed comparison.
