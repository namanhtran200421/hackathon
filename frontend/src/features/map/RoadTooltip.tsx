/**
 * The small box with a road's details, shown next to the mouse on the map.
 */

import { STYLE, type RoadInfo } from "@traffic-lab/simulation";
import { whole } from "../../lib/format";
import type { RenderStore } from "../simulation/renderStore";
import { DIRECTION_WORDS } from "./drawing";

export interface TooltipPosition {
  x: number;
  y: number;
  road: RoadInfo;
  /** Width of the map area, so the box never runs off its right edge. */
  stageWidth: number;
}

interface RoadTooltipProps {
  tooltip: TooltipPosition | null;
  store: RenderStore;
  clickMode: boolean;
  hasBaseline: boolean;
}

export default function RoadTooltip({ tooltip, store, clickMode, hasBaseline }: RoadTooltipProps) {
  if (!tooltip) {
    return null;
  }
  const road = tooltip.road;
  const styles = store.styles;
  const at = road.index * STYLE.fields;
  const direction = DIRECTION_WORDS[road.direction] || road.direction;

  let lanes = road.lanes + " lanes";
  if (styles) {
    if (styles[at + STYLE.closed]) {
      lanes = "closed";
    } else {
      lanes = styles[at + STYLE.lanesOpen] + " of " + road.lanes + " lanes open";
    }
  }

  let flow: string | null = null;
  if (styles && store.measured > 0) {
    const hours = Math.max(1 / 3600, store.measured / 3600);
    flow = whole(styles[at + STYLE.winCount] / hours) + " cars/hour";
    if (hasBaseline) {
      flow = flow + " · baseline " + whole(styles[at + STYLE.baseCount]);
    }
  }

  let hint = "Click to choose this street";
  if (clickMode) {
    hint = "Click to close or reopen";
  }

  const position = {
    left: Math.min(tooltip.x + 14, tooltip.stageWidth - 230),
    top: Math.max(8, tooltip.y - 12),
  };

  return (
    <div className="map-tip" style={position} aria-hidden="true">
      <strong>{road.street}</strong>
      <span>
        Section {road.section} · {direction} · {lanes}
      </span>
      {flow && <span>{flow}</span>}
      <small>{hint}</small>
    </div>
  );
}
