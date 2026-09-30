/**
 * useTrafficSim — the React side of the simulation.
 *
 * Starts the background worker (/sim/worker.js), sends it the user's settings
 * and button presses, and keeps the latest results in React state.
 *
 * Car positions go into `store` (see renderStore.ts), which the map reads on
 * every screen refresh. The numbers shown on the page reach React at most
 * about seven times a second.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CAR_FIELDS,
  DEFAULT_SETTINGS,
  FOREVER,
  SETUP_ONLY,
  type ButtonName,
  type Metrics,
  type PageMessage,
  type SettingName,
  type Settings,
  type World,
  type WorkerMessage,
} from "@traffic-lab/simulation";
import { loadBaseline, storeBaseline } from "../baseline/storage";
import { carsOnScreen, emptyStore, type RenderStore } from "./renderStore";
import { DEFAULT_SPEED } from "./speeds";
import type { BaselineRecording, Sample, SimulatorPhase } from "./types";

const MAX_LOG_LINES = 400;
const MAX_SAMPLES = 3000;
const ENGINE_FAILED = "The simulator could not load. Check your internet connection, then press Try again.";

/** The model's pop-up messages, reworded for everyday users. */
const FRIENDLY_NOTICES: Record<string, string> = {
  "Reopen all roads and run a fresh baseline before saving.":
    "A baseline must be recorded with every road open. Press Reopen all streets, then Restart and run again.",
  "Run past the warm-up period first (at least 1 minute of measurement).":
    "Let it run a little longer first: past the warm-up time plus at least one minute.",
};

function friendlyNotice(text: string): string {
  if (Object.hasOwn(FRIENDLY_NOTICES, text)) {
    return FRIENDLY_NOTICES[text];
  }
  return text;
}

/** One point for the results charts. */
export function sampleFrom(metrics: Metrics): Sample {
  let meanTrip: number | null = null;
  let meanDelay: number | null = null;
  if (metrics.completed > 0) {
    meanTrip = metrics.meanTrip;
    meanDelay = metrics.meanDelay;
  }
  return {
    t: metrics.ticks,
    cars: metrics.cars,
    waiting: metrics.waiting,
    completed: metrics.completed,
    meanTrip: meanTrip,
    meanDelay: meanDelay,
    vehicleHours: metrics.vehicleHours,
    generated: metrics.generated,
    stranded: metrics.stranded,
    measured: metrics.measured,
  };
}

interface BaselineRequest {
  settings: Settings;
  keepRunning: boolean;
}

export type TrafficSimulation = ReturnType<typeof useTrafficSim>;

export function useTrafficSim() {
  const [phase, setPhase] = useState<SimulatorPhase>("loading");
  const [status, setStatus] = useState("Loading the simulator…");
  const [error, setError] = useState("");
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [appliedSettings, setAppliedSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [world, setWorld] = useState<World | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [history, setHistory] = useState<Sample[]>([]);
  const [baseline, setBaseline] = useState<BaselineRecording | null>(null);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [speed, setSpeedState] = useState(DEFAULT_SPEED);
  const [keepRunning, setKeepRunningState] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const store = useRef<RenderStore>(emptyStore());
  const worker = useRef<Worker | null>(null);
  const settingsRef = useRef<Settings>(DEFAULT_SETTINGS);
  const keepRunningRef = useRef(false);
  const speedRef = useRef(DEFAULT_SPEED);
  const settingsAtRestart = useRef<Settings>(DEFAULT_SETTINGS);
  const latestMetrics = useRef<Metrics | null>(null);
  const samples = useRef<Sample[]>([]);
  const sampleStep = useRef(1);
  const updateTimer = useRef<number | null>(null);
  const csvWaiting = useRef<((text: string) => void) | null>(null);
  const baselineAskedWith = useRef<BaselineRequest | null>(null);
  const baselineBeingSaved = useRef<BaselineRecording | null>(null);
  const baselineRestored = useRef(false);
  const reducedMotion = useRef(false);

  const send = useCallback(function (message: PageMessage) {
    if (worker.current) {
      worker.current.postMessage(message);
    }
  }, []);

  useEffect(
    function startWorker() {
      reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const background = new Worker("/sim/worker.js");
      worker.current = background;
      baselineRestored.current = false;
      store.current = emptyStore();
      setPhase("loading");
      setError("");
      setStatus("Loading the simulator…");

      /** Pass the newest numbers to React. */
      function updatePage(): void {
        updateTimer.current = null;
        if (latestMetrics.current) {
          setMetrics(latestMetrics.current);
        }
        setHistory(samples.current.slice());
      }

      function updatePageNow(): void {
        if (updateTimer.current !== null) {
          clearTimeout(updateTimer.current);
        }
        updatePage();
      }

      function onReady(modelSettings: Settings): void {
        // Keep the counting-time slider where the user left it.
        const next = Object.assign({}, modelSettings, { "measure-s": settingsRef.current["measure-s"] });
        settingsRef.current = next;
        settingsAtRestart.current = next;
        setSettings(next);
      }

      function onWorld(newWorld: World): void {
        // Bring back a baseline saved earlier in this browser, once per worker.
        if (!baselineRestored.current) {
          baselineRestored.current = true;
          const stored = loadBaseline();
          if (stored) {
            setBaseline(stored);
            if (stored.saved) {
              send({ type: "restore-baseline", saved: stored.saved });
            }
          }
        }
        samples.current = [];
        sampleStep.current = 1;
        const drawing = store.current;
        drawing.world = newWorld;
        drawing.worldVersion = drawing.worldVersion + 1;
        drawing.from = new Float32Array(0);
        drawing.fromIndex = new Map();
        drawing.cars = new Float32Array(0);
        drawing.sites = null;
        drawing.ticks = -1;
        setWorld(newWorld);
        setAppliedSettings(settingsAtRestart.current);
        setPhase("ready");
        setStatus("Ready. Press Start to begin.");
      }

      function rememberSample(current: Metrics): void {
        const last = samples.current[samples.current.length - 1];
        if (last && current.ticks < last.t + sampleStep.current) {
          return;
        }
        samples.current.push(sampleFrom(current));
        // Very long runs: keep every second point and sample half as often.
        if (samples.current.length > MAX_SAMPLES) {
          samples.current = samples.current.filter(function (_sample, index) {
            return index % 2 === 0;
          });
          sampleStep.current = sampleStep.current * 2;
        }
      }

      /** After Save baseline, keep a full copy of the run if the model accepted it. */
      function checkBaselineSaved(current: Metrics, isRunning: boolean): void {
        const asked = baselineAskedWith.current;
        if (!asked || isRunning) {
          return;
        }
        baselineAskedWith.current = null;
        const saved = current.baseline;
        const accepted =
          current.hasBaseline &&
          saved !== null &&
          saved.measured === current.measured &&
          saved.completed === current.completed;
        if (!accepted) {
          return;
        }
        const recording: BaselineRecording = {
          metrics: current,
          history: samples.current.slice(),
          settings: asked.settings,
          forever: asked.keepRunning,
          savedAt: Date.now(),
        };
        setBaseline(recording);
        baselineBeingSaved.current = recording;
        send({ type: "export-baseline" });
      }

      function onFrame(message: WorkerMessage & { type: "frame" }): void {
        const now = performance.now();
        const current = message.metrics;
        const drawing = store.current;
        const moved = current.ticks > drawing.ticks && drawing.ticks >= 0;

        if (moved && !reducedMotion.current) {
          // Glide from where the cars are on screen now.
          const shown = carsOnScreen(drawing, now);
          const index = new Map<number, number>();
          for (let i = 0; i < shown.length; i += CAR_FIELDS) {
            index.set(shown[i], i);
          }
          drawing.from = shown;
          drawing.fromIndex = index;
          if (message.running) {
            let gap = 100;
            if (drawing.frameAt) {
              gap = now - drawing.frameAt;
            }
            let smoothed = gap;
            if (drawing.duration) {
              smoothed = drawing.duration * 0.6 + gap * 0.4;
            }
            drawing.duration = Math.min(1200, Math.max(16, smoothed));
          } else {
            // A single step glides for a moment.
            drawing.duration = 220;
          }
        } else {
          drawing.from = new Float32Array(0);
          drawing.fromIndex = new Map();
          drawing.duration = 0;
        }

        drawing.cars = message.cars;
        drawing.frameAt = now;
        drawing.ticks = current.ticks;
        drawing.measured = current.measured;
        drawing.frameVersion = drawing.frameVersion + 1;
        if (message.styles && message.stylesView) {
          drawing.styles = message.styles;
          drawing.stylesView = message.stylesView;
          drawing.stylesVersion = drawing.stylesVersion + 1;
        }
        if (message.sites) {
          drawing.sites = message.sites;
        }

        latestMetrics.current = current;
        rememberSample(current);
        checkBaselineSaved(current, message.running);

        if (!message.running) {
          updatePageNow();
        } else if (updateTimer.current === null) {
          updateTimer.current = window.setTimeout(updatePage, 150);
        }
      }

      function onRunning(message: WorkerMessage & { type: "running" }): void {
        setRunning(message.running);
        if (!message.running) {
          updatePageNow();
        }
        if (message.reason === "finished") {
          setStatus(
            "The counting time is over. Turn on Keep running, or make the counting time longer, to carry on.",
          );
        } else if (message.reason === "paused" && latestMetrics.current) {
          setStatus("Paused. Press Start to carry on.");
        } else if (message.running) {
          setStatus("Running. Press Pause to stop.");
        }
      }

      function onBaselineExported(message: WorkerMessage & { type: "baseline" }): void {
        const recording = baselineBeingSaved.current;
        if (!recording) {
          return;
        }
        baselineBeingSaved.current = null;
        const complete: BaselineRecording = Object.assign({}, recording);
        if (message.saved) {
          complete.saved = message.saved;
        }
        storeBaseline(complete);
        setBaseline(complete);
      }

      background.onmessage = function (event: MessageEvent<WorkerMessage>) {
        const message = event.data;
        if (message.type === "status") {
          setStatus(message.message);
          if (message.phase === "building") {
            setPhase("building");
          }
        } else if (message.type === "ready") {
          onReady(message.settings);
        } else if (message.type === "world") {
          onWorld(message.world);
        } else if (message.type === "frame") {
          onFrame(message);
        } else if (message.type === "running") {
          onRunning(message);
        } else if (message.type === "output") {
          setLog(function (lines) {
            return lines.concat(message.lines).slice(-MAX_LOG_LINES);
          });
        } else if (message.type === "output-clear") {
          setLog([]);
        } else if (message.type === "notice") {
          setStatus(friendlyNotice(message.message));
        } else if (message.type === "baseline") {
          onBaselineExported(message);
        } else if (message.type === "csv") {
          if (csvWaiting.current) {
            csvWaiting.current(message.text);
            csvWaiting.current = null;
          }
        } else if (message.type === "error") {
          if (message.fatal) {
            setPhase("error");
            setError(ENGINE_FAILED);
          } else {
            setError(message.message);
          }
        }
      };

      background.onerror = function (event) {
        event.preventDefault();
        setPhase("error");
        setRunning(false);
        setError(ENGINE_FAILED);
      };

      // Draw the streets straight away while the simulator loads.
      let cancelled = false;
      fetch("/sim/network-osm.json")
        .then(function (response) {
          if (response.ok) {
            return response.json() as Promise<World>;
          }
          return null;
        })
        .then(function (preview) {
          if (!preview || cancelled || store.current.world) {
            return;
          }
          store.current.world = preview;
          store.current.worldVersion = store.current.worldVersion + 1;
          setWorld(preview);
        })
        .catch(function () {
          // The preview is only a nicety; the simulator sends the real map anyway.
        });

      const startingSettings: Partial<Settings> = Object.assign({}, settingsRef.current);
      if (keepRunningRef.current) {
        startingSettings["measure-s"] = FOREVER;
      }
      send({ type: "init", speed: speedRef.current, settings: startingSettings });

      return function stopWorker() {
        cancelled = true;
        if (updateTimer.current !== null) {
          clearTimeout(updateTimer.current);
        }
        background.terminate();
        worker.current = null;
      };
    },
    // The worker restarts only when the user presses Try again. The current
    // speed and settings are read from refs when it does.
    [attempt, send],
  );

  /** Move a slider, flip a switch or pick an option. */
  const set = useCallback(
    function <Name extends SettingName>(name: Name, value: Settings[Name]) {
      const next = Object.assign({}, settingsRef.current);
      next[name] = value;
      settingsRef.current = next;
      setSettings(next);
      // While Keep running is on, the counting time stays unlimited.
      if (name === "measure-s" && keepRunningRef.current) {
        return;
      }
      send({ type: "set", name: name, value: value });
    },
    [send],
  );

  /** Keep running: remove the time limit, or put the chosen limit back. */
  const setKeepRunning = useCallback(
    function (on: boolean) {
      setKeepRunningState(on);
      keepRunningRef.current = on;
      let countingTime = settingsRef.current["measure-s"];
      if (on) {
        countingTime = FOREVER;
      }
      send({ type: "set", name: "measure-s", value: countingTime });
    },
    [send],
  );

  const setSpeed = useCallback(
    function (value: number) {
      setSpeedState(value);
      speedRef.current = value;
      send({ type: "speed", speed: value });
    },
    [send],
  );

  /** The Restart button (NetLogo's Setup). */
  const restart = useCallback(
    function () {
      settingsAtRestart.current = settingsRef.current;
      setPhase("building");
      setStatus("Building the road map…");
      send({ type: "setup" });
    },
    [send],
  );

  /** Ask the worker for the road results as CSV text. */
  const exportCsv = useCallback(
    function (): Promise<string> {
      return new Promise(function (resolve) {
        csvWaiting.current = resolve;
        send({ type: "csv" });
      });
    },
    [send],
  );

  const restartNeeded = SETUP_ONLY.some(function (name) {
    return settings[name] !== appliedSettings[name];
  });

  return {
    phase: phase,
    status: status,
    setStatus: setStatus,
    error: error,
    settings: settings,
    world: world,
    metrics: metrics,
    history: history,
    baseline: baseline,
    running: running,
    log: log,
    speed: speed,
    keepRunning: keepRunning,
    store: store,
    restartNeeded: restartNeeded,
    set: set,
    setSpeed: setSpeed,
    setKeepRunning: setKeepRunning,
    restart: restart,
    exportCsv: exportCsv,

    start: function (): void {
      send({ type: "run", run: true });
    },
    pause: function (): void {
      send({ type: "run", run: false });
    },
    step: function (): void {
      send({ type: "step" });
    },

    /** Press one of the model's buttons by its NetLogo name. */
    command: function (name: ButtonName): void {
      if (name === "save-baseline") {
        // Remember the settings at the moment of the click.
        baselineAskedWith.current = { settings: settingsRef.current, keepRunning: keepRunningRef.current };
      }
      send({ type: "command", name: name });
    },

    clearBaseline: function (): void {
      send({ type: "command", name: "clear-baseline" });
      storeBaseline(null);
      setBaseline(null);
    },

    /** Choose a street and section (0 means the whole street). */
    select: function (street: string, section: number): void {
      send({ type: "select", street: street, block: section });
    },

    /** Close or reopen the road at map position (x, y). */
    click: function (x: number, y: number): void {
      send({ type: "click", x: x, y: y });
    },

    /** Start the simulator again after it failed to load. */
    reload: function (): void {
      setAttempt(function (count) {
        return count + 1;
      });
    },
  };
}
