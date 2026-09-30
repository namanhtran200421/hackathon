/**
 * The thin black bar and the yellow header with the name plate and links to
 * the parts of the page.
 */

import { TrafficCone } from "lucide-react";

export default function SiteHeader({ onOpenGuide }: { onOpenGuide: () => void }) {
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
          <nav aria-label="Page sections">
            <a href="#workbench">Simulator</a>
            <a href="#results">Results</a>
            <button onClick={onOpenGuide}>Quick guide</button>
          </nav>
        </div>
      </header>
    </>
  );
}
