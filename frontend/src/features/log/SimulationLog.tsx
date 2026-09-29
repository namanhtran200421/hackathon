/**
 * The simulation log: messages the model prints, newest at the bottom.
 */

import { useEffect, useRef } from "react";
import { TerminalSquare } from "lucide-react";

export default function SimulationLog({ lines }: { lines: string[] }) {
  const list = useRef<HTMLOListElement>(null);

  // Keep the newest message in view.
  useEffect(
    function () {
      if (list.current) {
        list.current.scrollTop = list.current.scrollHeight;
      }
    },
    [lines],
  );

  return (
    <div className="output panel" id="output">
      <div className="output-head">
        <h2>
          <TerminalSquare size={16} /> Simulation log
        </h2>
      </div>
      <ol ref={list} className="output-log" aria-label="Simulation log" aria-live="off" tabIndex={0}>
        {lines.length === 0 && <li className="muted">Nothing yet.</li>}
        {lines.map(function (line, index) {
          return <li key={index}>{line}</li>;
        })}
      </ol>
    </div>
  );
}
