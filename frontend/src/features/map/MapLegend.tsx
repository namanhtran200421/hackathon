/**
 * The key in the corner of the map. It changes with the map view.
 */

import type { ViewMode } from "@traffic-lab/simulation";

interface MapLegendProps {
  view: ViewMode;
  hasBaseline: boolean;
}

function ViewKey({ view, hasBaseline }: MapLegendProps) {
  if (view === "congestion") {
    return (
      <>
        <span>
          <i className="lg-road" /> Free
        </span>
        <span>
          <i className="lg-light" /> Light
        </span>
        <span>
          <i className="lg-busy" /> Busy
        </span>
        <span>
          <i className="lg-jam" /> Jammed
        </span>
      </>
    );
  }
  if (view === "volume") {
    return (
      <span>
        Fewer <i className="lg-volume" /> More cars
      </span>
    );
  }
  if (!hasBaseline) {
    return <span>Save a baseline to see changes</span>;
  }
  return (
    <>
      <span>
        <i className="lg-more" /> More traffic
      </span>
      <span>
        <i className="lg-less" /> Less traffic
      </span>
      <span>
        <i className="lg-road" /> About the same
      </span>
    </>
  );
}

export default function MapLegend({ view, hasBaseline }: MapLegendProps) {
  return (
    <div className="map-legend" aria-label="Map key">
      <ViewKey view={view} hasBaseline={hasBaseline} />
      <span>
        <i className="lg-closed" /> Closed
      </span>
      <span>
        <i className="lg-reduced" /> Lane closed
      </span>
      <span className="legend-break">
        <b className="lg-car" /> Moving
      </span>
      <span>
        <b className="lg-slow" /> Slow
      </span>
      <span>
        <b className="lg-stopped" /> Stopped
      </span>
      <span>
        <b className="lg-dest" /> Car park
      </span>
    </div>
  );
}
