---
version: alpha
name: Melbourne Traffic Lab
description: A map-first workbench for testing Melbourne street closures.
colors:
  primary: "#146B61"
  background: "#F3F6F6"
  surface: "#FFFFFF"
  ink: "#20343B"
  muted: "#52666D"
  border: "#DCE5E6"
  warning: "#B06A19"
  danger: "#B34749"
typography:
  display:
    fontFamily: "Georgia, serif"
  sans:
    fontFamily: "Arial, sans-serif"
  mono:
    fontFamily: "ui-monospace, monospace"
rounded:
  DEFAULT: "0.75rem"
  sm: "0.375rem"
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

A practical traffic workbench for the Melbourne hackathon team. The single job is to configure a scenario, run the existing NetLogo model, and compare a closure with an open-road baseline. English (Australia), desktop first with a stacked mobile layout. Domain constraints come from combined/README.md: real OSM geometry, illustrative demand and signals, no calibrated predictions.

Signature: the actual diagonal Melbourne street network, drawn like a transport planning map on a pale blue-grey drafting surface. Small green vehicle marks move smoothly with the live model. A restrained serif heading provides a civic character; controls remain familiar and quiet. No marketing hero, ornamental dashboard cards, or red default road network.

This file generates color, font, radius and spacing tokens via scripts/design-tokens.mjs into src/app/tokens.css. Global CSS and the map consume these tokens. UI behavior lives in UX-CONTRACT.md.

## Colors

Green marks primary actions and moving traffic. Amber marks slow traffic and a dark rust marks stopped cars. Congestion runs from the neutral road grey through mustard and orange to a dark wine for jammed roads. Volume is a grey-to-teal ramp. Change vs baseline uses orange for more traffic and blue for less. Plum marks a closed lane. Muted red marks closed roads and errors only. Surface and border tokens separate control areas. Map-only colors are CSS semantic aliases in globals.css. Light theme only; forced-colors uses system values. Scrollbars use muted thumb and background track with primary hover/active.

## Typography

Georgia appears only in the page title. Arial/system sans-serif owns labels and prose. Monospace owns elapsed time and map coordinates. Numeric readouts use tabular figures. Minimum body size 14px, ordinary labels 14px. Muted captions remain readable.

## Layout

A compact header with the Quick guide button and a title precede a 285–320px model-controls panel beside a dominant canvas map. The run bar (Setup, Go, Step, speed, Run forever, clock) sits under the map, then figures, the baseline comparison and the model output. Below 900px the map comes first and the controls stack beneath it. Below 430px, run buttons share one row and figures use two columns. No horizontal document overflow. Reserve a map area and stable feedback region through loading and errors.

## Elevation & Depth

White panels on a cool grey background with thin borders; no floating card pile. A small shadow belongs only to the map legend. No decorative gradients.

## Shapes

12px panel corners and 6px controls. Map lines have round ends. Status indicators pair a shape with text.

## Components

Button states are shared via global classes: primary green, secondary outline, ghost for reversible remove actions. Switches are native checkboxes with role switch, drawn as a track and thumb. A small uppercase Setup tag marks controls that apply only after Setup. A visible 3px focus ring and 44px minimum button target are consistent. Busy/disabled controls retain geometry. Lucide icons use 18px strokes with accompanying text or accessible names.

Native selects and range inputs are canonical; platform popup geometry is acceptable. All fields have labels and errors preserve values. A persistent role=status region announces lifecycle messages. No alert, confirm or prompt; the Quick guide is a native dialog shown as a right-hand side sheet.

Animation interpolates between actual model ticks; it never fabricates traffic. Reduced motion disables transitions and shows each tick without interpolation. Ctrl + scroll or the zoom buttons zoom the map; drag pans when zoomed. Road state has a text legend; closed streets also use dashed strokes. Metrics and downloadable CSV provide nonvisual results.

## Do's and Don'ts

- Use the real road geometry and engine statistics.
- State synthetic traffic assumptions near the map.
- Keep red limited to closures and failures.
- Do not label an incomplete or cancelled run as a completed comparison.
