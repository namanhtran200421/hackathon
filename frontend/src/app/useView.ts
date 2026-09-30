/**
 * Which page is showing: the Simulator or the Report.
 *
 * The page lives in the address's # part ("#report"), so both pages are one
 * static file: no server set-up is needed, and the live simulation and any
 * planner search keep running when switching between them. Any other
 * address, such as "#workbench", shows the simulator.
 */

import { useEffect, useRef, useState } from "react";

export type View = "simulator" | "report";

export function viewFromHash(hash: string): View {
  if (hash === "#report" || hash.startsWith("#report-")) {
    return "report";
  }
  return "simulator";
}

export function useView(): View {
  const [view, setView] = useState<View>(function () {
    return viewFromHash(window.location.hash);
  });
  const firstView = useRef(true);

  useEffect(function () {
    function follow(): void {
      setView(viewFromHash(window.location.hash));
    }
    window.addEventListener("hashchange", follow);
    return function () {
      window.removeEventListener("hashchange", follow);
    };
  }, []);

  // After switching page, go to the part the link points at (or the top), and
  // move keyboard focus there so screen readers follow.
  useEffect(
    function () {
      if (firstView.current) {
        firstView.current = false;
        return;
      }
      const id = window.location.hash.slice(1);
      let target: HTMLElement | null = null;
      if (id) {
        target = document.getElementById(id);
      }
      if (target && id !== "workbench" && id !== "report") {
        target.scrollIntoView();
        return;
      }
      window.scrollTo(0, 0);
      const heading = document.querySelector<HTMLElement>("[data-page-heading]");
      if (heading) {
        heading.focus({ preventScroll: true });
      }
    },
    [view],
  );

  return view;
}
