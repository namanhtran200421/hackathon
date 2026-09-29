/**
 * The whole page: header, introduction, the simulator (settings, map, figures,
 * comparison, log and results) and footer.
 */

import { useEffect, useState } from "react";
import Hero from "../components/layout/Hero";
import SiteFooter from "../components/layout/SiteFooter";
import SiteHeader from "../components/layout/SiteHeader";
import ComparePanel from "../features/baseline/ComparePanel";
import { differences } from "../features/baseline/differences";
import Figures from "../features/figures/Figures";
import QuickGuide from "../features/guide/QuickGuide";
import SimulationLog from "../features/log/SimulationLog";
import MapPanel from "../features/map/MapPanel";
import Results from "../features/results/Results";
import SettingsPanel from "../features/settings/SettingsPanel";
import type { ResultsSnapshot, Selection } from "../features/simulation/types";
import { useTrafficSim } from "../features/simulation/useTrafficSim";
import StatusLine from "./StatusLine";

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
  const sim = useTrafficSim();
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

  function openGuide(): void {
    setGuideOpen(true);
  }

  return (
    <>
      <a className="skip-link" href="#workbench">
        Skip to the simulator
      </a>
      <SiteHeader onOpenGuide={openGuide} />
      <Hero onOpenGuide={openGuide} />

      <main id="workbench" className="container">
        <div className="workbench">
          <SettingsPanel
            sim={sim}
            selection={selection}
            onChoose={choose}
            clickMode={clickMode}
            onToggleClickMode={function () {
              setClickMode(!clickMode);
            }}
          />

          <section className="results" aria-label="Simulator">
            <MapPanel
              sim={sim}
              selection={selection}
              onChoose={choose}
              clickMode={clickMode}
              onStopClickMode={function () {
                setClickMode(false);
              }}
            />
            <Figures metrics={metrics} />
            <ComparePanel sim={sim} differences={settingDifferences} onDownload={downloadCsv} />
            <SimulationLog lines={sim.log} />
            <StatusLine sim={sim} />
            <Results
              snapshot={snapshot}
              baseline={sim.baseline}
              running={sim.running}
              differences={settingDifferences}
            />
          </section>
        </div>
      </main>

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
