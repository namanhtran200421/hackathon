/**
 * The thin black bar and the yellow header with the name plate and page links.
 */

import { TrafficCone } from "lucide-react";
import type { View } from "../../app/useView";

interface SiteHeaderProps {
  view: View;
  onOpenGuide: () => void;
  /** A works-planner search is running in the background. */
  planning: boolean;
}

export default function SiteHeader({ view, onOpenGuide, planning }: SiteHeaderProps) {
  let simulatorClass = "";
  let reportClass = "";
  if (view === "simulator") {
    simulatorClass = "active";
  } else {
    reportClass = "active";
  }

  function current(active: boolean): "page" | undefined {
    if (active) {
      return "page";
    }
    return undefined;
  }

  return (
    <>
      <div className="utility-bar">
        <div className="container">
          <span>
            <TrafficCone size={15} /> Melbourne CBD · traffic simulator
          </span>
          <span className="utility-note">
            <span className="status-dot" /> Runs in your browser
          </span>
        </div>
      </div>
      <header className="site-header">
        <div className="container">
          <a className="brand" href="#workbench" aria-label="Melbourne Traffic Lab home">
            <span className="brand-plate">
              <span className="brand-top">MELBOURNE</span>
              <span className="brand-box">TRAFFIC LAB</span>
            </span>
          </a>
          <nav aria-label="Pages">
            <a href="#workbench" className={simulatorClass} aria-current={current(view === "simulator")}>
              Simulator
            </a>
            <a href="#report" className={reportClass} aria-current={current(view === "report")}>
              Report
              {planning && <span className="nav-busy" title="The works planner is running" />}
            </a>
            <button onClick={onOpenGuide}>Quick guide</button>
          </nav>
        </div>
      </header>
    </>
  );
}
