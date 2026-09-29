"use client";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";

const steps: [string, string][] = [
  [
    "Start the traffic",
    "The road network is set up when the page opens. Press Go to run the model and press it again to pause. Step 1 s moves the model forward one simulated second.",
  ],
  [
    "Set the pace, or run forever",
    "Simulation speed sets how many simulated seconds pass each real second. Max runs as fast as your computer allows. The model normally stops when the measurement window ends. Turn on Run forever to keep it going until you pause; it then measures everything after the warm-up.",
  ],
  [
    "Close a street",
    "Choose a street, an extent and a closure type, then press Apply closure. You can also turn on Click roads and click a road on the map to close it; click it again to reopen it. Closures apply straight away, even while the model runs. Reopen selected and Reopen all restore every lane.",
  ],
  [
    "Compare with a baseline",
    "Run with all roads open until the warm-up has passed plus at least one minute, then press Save baseline. Press Setup, which reopens every road, then apply your closure and press Go. Scheduled closure can apply it for you at a set time. Switch the view to Change vs baseline and read the comparison table. Keep the other settings and the run length the same; changing settings clears the baseline at the next Setup.",
  ],
  [
    "Read the map",
    "Congestion colours each road by how full it is. Volume shows vehicles per hour. Change vs baseline shows roads with more traffic than the baseline in orange and less in blue. Closed roads are dashed red and lane reductions are plum. Hover over a road for its flow.",
  ],
  [
    "Export the results",
    "Export CSV downloads the flow and travel time for every road, with the same columns as the desktop model's export.",
  ],
];

const reference: [string, string][] = [
  ["Setup, Go / pause, Step 1 second", "Buttons under the map"],
  ["Speed slider", "Simulation speed, under the map"],
  ["view-mode", "View, above the map"],
  ["network-source, seed, fixed-seed?", "Scenario"],
  ["demand-veh-per-hour, through-traffic-%, informed-drivers-%", "Scenario"],
  ["Choose street, Choose section, closure-type", "Road closures"],
  ["Apply closure, Reopen selected, Reopen all", "Road closures"],
  ["Click roads, close-whole-street?", "Road closures"],
  ["scheduled-closure?, closure-start-min", "Road closures"],
  [
    "speed-limit-kmh, cycle-length, ew-green-share, signal-coordination, hook-turns?",
    "Signals & driving",
  ],
  ["reroute-interval, route-noise", "Routing"],
  ["warm-up-s, measure-s", "Measurement"],
  ["Save baseline, Export CSV", "Compare with a baseline"],
  [
    "Cars, Waiting at gates, Completed, Mean trip, Stranded, Elapsed",
    "Figures under the map",
  ],
  ["Selected extent, Closures", "Road closures"],
  ["Output area", "Model output"],
  ["Info tab", "About the model, below"],
];

export default function QuickGuide({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className="guide"
      aria-labelledby="guide-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) onClose();
      }}
    >
      <div className="guide-body">
        <div className="guide-header">
          <div>
            <p className="eyebrow">QUICK GUIDE</p>
            <h2 id="guide-title">Run your first scenario</h2>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close quick guide"
            autoFocus
          >
            <X size={18} />
          </button>
        </div>
        <ol className="guide-steps">
          {steps.map(([title, text]) => (
            <li key={title}>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ol>
        <div className="guide-note">
          <strong>Settings marked Setup</strong> are read when the network is
          built. Change them, then press Setup. Everything else, including
          demand and closures, applies while the model runs.
        </div>
        <h3 className="guide-subhead">Where each NetLogo control is</h3>
        <table className="guide-table">
          <thead>
            <tr>
              <th scope="col">NetLogo</th>
              <th scope="col">Here</th>
            </tr>
          </thead>
          <tbody>
            {reference.map(([desktop, web]) => (
              <tr key={desktop}>
                <td>{desktop}</td>
                <td>{web}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3 className="guide-subhead" id="about">
          About the model
        </h3>
        <p className="guide-text">
          Road geometry, one-way rules and available lane and speed tags come
          from OpenStreetMap. Traffic demand, signal timings and destinations
          are synthetic. Use it to explore possible effects of a closure. It is
          not a calibrated forecast or a safety assessment, and it has no trams,
          buses, pedestrians or real turn restrictions.
        </p>
        <p className="guide-text">
          The same seed and settings give the same arrivals and trip requests,
          so a closure run is compared fairly with its baseline. Averages only
          include trips that finish inside the measurement window. Read waiting,
          stranded, active and completed counts together.
        </p>
      </div>
    </dialog>
  );
}
