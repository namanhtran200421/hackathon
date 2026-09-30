/**
 * The whole site: header, the Simulator or Report page, and footer.
 *
 * The live simulation and the works planner are started here, above both
 * pages, so switching page never stops either of them.
 */

import { useEffect, useState } from "react";
import Hero from "../components/layout/Hero";
import SiteFooter from "../components/layout/SiteFooter";
import SiteHeader from "../components/layout/SiteHeader";
import { differences } from "../features/baseline/differences";
import QuickGuide from "../features/guide/QuickGuide";
import type { Plan, WorksRequest } from "../features/planner/types";
import { usePlanner } from "../features/planner/usePlanner";
import { closedWindow, whenText } from "../features/planner/wording";
import type { ResultsSnapshot, Selection } from "../features/simulation/types";
import { useTrafficSim } from "../features/simulation/useTrafficSim";
import ReportPage from "./ReportPage";
import SimulatorPage from "./SimulatorPage";
import { useView } from "./useView";

/** Save text as a file on the user's computer. */
function downloadFile(text: string, fileName: string): void {
  const link = document.createElement("a");
  const address = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8;" }));
  link.href = address;
  link.download = fileName;
  link.click();
  setTimeout(function () {
    URL.revokeObjectURL(address);
  }, 1000);
}

export default function App() {
  const view = useView();
  const sim = useTrafficSim();
  const planner = usePlanner(sim.settings);
  const metrics = sim.metrics;
  const [guideOpen, setGuideOpen] = useState(false);
  const [clickMode, setClickMode] = useState(false);
  const [pendingChoice, setPendingChoice] = useState<Selection | null>(null);
  const [snapshot, setSnapshot] = useState<ResultsSnapshot | null>(null);

  // The chosen street comes from the model. Right after the user picks one,
  // show their choice until the model confirms it.
  let selection: Selection = { street: "Collins St", section: 0 };
  if (metrics) {
    selection = { street: metrics.selectedStreet, section: metrics.selectedBlock };
  }
  if (pendingChoice) {
    selection = pendingChoice;
  }

  useEffect(
    function () {
      if (!pendingChoice || !metrics) {
        return;
      }
      if (
        metrics.selectedStreet === pendingChoice.street &&
        metrics.selectedBlock === pendingChoice.section
      ) {
        setPendingChoice(null);
      }
    },
    [metrics, pendingChoice],
  );

  useEffect(
    function () {
      if (sim.error) {
        setPendingChoice(null);
      }
    },
    [sim.error],
  );

  function choose(street: string, section: number): void {
    setPendingChoice({ street: street, section: section });
    sim.select(street, section);
  }

  // Results use a copy taken whenever the traffic pauses or stops, so the
  // tables and charts stay still while the traffic moves.
  const styles = sim.store.current.styles;
  useEffect(
    function () {
      if (sim.running || !metrics || !sim.world || !styles) {
        return;
      }
      if (metrics.ticks === 0 || metrics.measured <= 0) {
        setSnapshot(null);
        return;
      }
      setSnapshot({ metrics: metrics, history: sim.history, styles: styles.slice(), world: sim.world });
    },
    [sim.running, metrics, sim.world, styles, sim.history],
  );

  let settingDifferences: ReturnType<typeof differences> = [];
  if (metrics && metrics.hasBaseline) {
    settingDifferences = differences(sim.baseline, sim.settings, sim.keepRunning);
  }

  async function downloadCsv(): Promise<void> {
    const text = await sim.exportCsv();
    downloadFile(text, "combined-link-results.csv");
    sim.setStatus("Downloaded the road numbers as combined-link-results.csv.");
  }

  /**
   * Set the simulator up to show a planned closure: the same street and kind
   * of closure, traffic following that time of day, and the works in place
   * from the start. Then switch to the Simulator page.
   */
  function tryInSimulator(plan: Plan, request: WorksRequest): void {
    sim.pause();
    let profile: "SCATS weekday" | "SCATS weekend" = "SCATS weekday";
    if (plan.dayType === "weekend") {
      profile = "SCATS weekend";
    }
    sim.set("demand-profile", profile);
    sim.set("profile-start-hour", plan.start);
    sim.set("closure-type", request.closureType);
    sim.set("scheduled-closure?", true);
    sim.set("closure-start-min", 0);
    choose(request.street, request.section);
    sim.restart(
      "Set up the recommended plan: " +
        whenText(plan) +
        ", " +
        closedWindow(plan) +
        ", with traffic for that time of day and the works in place from the start. Press Start to watch.",
    );
    window.location.hash = "#workbench";
  }

  function openGuide(): void {
    setGuideOpen(true);
  }

  let skipTarget = "#workbench";
  let skipText = "Skip to the simulator";
  if (view === "report") {
    skipTarget = "#report";
    skipText = "Skip to the report";
  }

  return (
    <>
      <a className="skip-link" href={skipTarget}>
        {skipText}
      </a>
      <SiteHeader view={view} onOpenGuide={openGuide} planning={planner.state.phase === "running"} />

      {view === "simulator" && (
        <>
          <Hero onOpenGuide={openGuide} />
          <SimulatorPage
            sim={sim}
            selection={selection}
            onChoose={choose}
            clickMode={clickMode}
            onSetClickMode={setClickMode}
            differences={settingDifferences}
            snapshot={snapshot}
            onDownload={downloadCsv}
          />
        </>
      )}
      {view === "report" && (
        <ReportPage
          sim={sim}
          planner={planner}
          selection={selection}
          snapshot={snapshot}
          differences={settingDifferences}
          onTryInSimulator={tryInSimulator}
        />
      )}

      <SiteFooter onOpenGuide={openGuide} />
      <QuickGuide
        open={guideOpen}
        onClose={function () {
          setGuideOpen(false);
        }}
      />
    </>
  );
}
