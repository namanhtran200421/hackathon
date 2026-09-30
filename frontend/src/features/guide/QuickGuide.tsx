/**
 * The Quick guide: a side panel that explains the simulator in a few short steps,
 * where each desktop NetLogo control is, and what the model can tell you.
 */

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { STEPS, WHERE_TO_FIND } from "./content";

interface QuickGuideProps {
  open: boolean;
  onClose: () => void;
}

export default function QuickGuide({ open, onClose }: QuickGuideProps) {
  const dialog = useRef<HTMLDialogElement>(null);

  // Open and close the browser's dialog to match the `open` prop.
  useEffect(
    function () {
      const panel = dialog.current;
      if (!panel) {
        return;
      }
      if (open && !panel.open) {
        panel.showModal();
      }
      if (!open && panel.open) {
        panel.close();
      }
    },
    [open],
  );

  return (
    <dialog
      ref={dialog}
      className="guide"
      aria-labelledby="guide-title"
      onClose={onClose}
      onClick={function (event) {
        // A click on the dark backdrop closes the guide.
        if (event.target === dialog.current) {
          onClose();
        }
      }}
    >
      <div className="guide-body">
        <div className="guide-header">
          <div>
            <p className="eyebrow">QUICK GUIDE</p>
            <h2 id="guide-title">Run your first scenario</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close the quick guide" autoFocus>
            <X size={18} />
          </button>
        </div>

        <p className="guide-intro">
          This simulates traffic in Melbourne&rsquo;s city centre, second by second, right in your browser.
          Every control from the desktop NetLogo model is here.
        </p>

        <ol className="guide-steps">
          {STEPS.map(function (step) {
            return (
              <li key={step[0]}>
                <h3>{step[0]}</h3>
                <p>{step[1]}</p>
              </li>
            );
          })}
        </ol>

        <div className="guide-note">
          <strong>Settings tagged Restart</strong> are used when the road map is built. Change them, then
          press Restart. Everything else, including closures and the number of cars, changes straight away.
        </div>

        <h3 className="guide-subhead">Where each NetLogo control is</h3>
        <table className="guide-table">
          <thead>
            <tr>
              <th scope="col">In NetLogo</th>
              <th scope="col">On this page</th>
            </tr>
          </thead>
          <tbody>
            {WHERE_TO_FIND.map(function (row) {
              return (
                <tr key={row[0]}>
                  <td>{row[0]}</td>
                  <td>{row[1]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <h3 className="guide-subhead" id="about">
          About the model
        </h3>
        <p className="guide-text">
          The streets, one-way rules, lanes and speed limits come from OpenStreetMap. The number of cars,
          where they go and the traffic light timings are made up for the model. Use it to explore what might
          happen when a street closes. It is not a forecast or a safety assessment, and it has no trams,
          buses, bikes or people walking.
        </p>
        <p className="guide-text">
          The same traffic pattern number and settings give the same cars arriving at the same times, so a
          closure is compared fairly with its baseline. Averages only count trips that finish during the
          counting time.
        </p>
      </div>
    </dialog>
  );
}
