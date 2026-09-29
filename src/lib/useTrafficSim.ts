"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULTS, DEFAULT_SPEED, FOREVER, SETUP_ONLY } from "./controls.mjs";
import {
  CAR_FIELDS,
  type Metrics,
  type RenderStore,
  type SettingName,
  type Settings,
  type World,
} from "./types";

const MAX_OUTPUT_LINES = 400;

function emptyStore(): RenderStore {
  return {
    world: null,
    worldVersion: 0,
    styles: null,
    stylesView: DEFAULTS["view-mode"],
    stylesVersion: 0,
    cars: new Float32Array(0),
    from: new Float32Array(0),
    fromIndex: new Map(),
    frameAt: 0,
    duration: 0,
    ticks: 0,
    measured: 0,
    frameVersion: 0,
  };
}

/** Car positions currently on screen, so the next frame animates from them. */
function displayed(store: RenderStore, now: number) {
  const { cars, from, fromIndex, frameAt, duration } = store;
  const t = duration > 0 ? Math.min(1, (now - frameAt) / duration) : 1;
  if (t >= 1 || !from.length) return cars;
  const out = new Float32Array(cars);
  for (let i = 0; i < cars.length; i += CAR_FIELDS) {
    const j = fromIndex.get(cars[i]);
    if (j === undefined) continue;
    out[i + 1] = from[j + 1] + (cars[i + 1] - from[j + 1]) * t;
    out[i + 2] = from[j + 2] + (cars[i + 2] - from[j + 2]) * t;
    const turn = ((cars[i + 3] - from[j + 3] + 540) % 360) - 180;
    out[i + 3] = from[j + 3] + turn * t;
  }
  return out;
}

export type SimStatus = "loading" | "setting-up" | "ready" | "error";

export function useTrafficSim() {
  const [phase, setPhase] = useState<SimStatus>("loading");
  const [status, setStatus] = useState("Loading the NetLogo engine…");
  const [error, setError] = useState("");
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [applied, setApplied] = useState<Settings>(DEFAULTS);
  const [world, setWorld] = useState<World | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<string[]>([]);
  const [speed, setSpeedState] = useState(DEFAULT_SPEED);
  const [forever, setForeverState] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const store = useRef<RenderStore>(emptyStore());
  const worker = useRef<Worker | null>(null);
  const settingsRef = useRef<Settings>(DEFAULTS);
  const pendingSetup = useRef<Settings>(DEFAULTS);
  const latest = useRef<Metrics | null>(null);
  const commitTimer = useRef<number | null>(null);
  const csvRequest = useRef<((text: string) => void) | null>(null);
  const reducedMotion = useRef(false);

  const send = useCallback((message: Record<string, unknown>) => {
    worker.current?.postMessage(message);
  }, []);

  useEffect(() => {
    reducedMotion.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const w = new Worker("/sim/worker.js");
    worker.current = w;
    store.current = emptyStore();
    setPhase("loading");
    setError("");
    setStatus("Loading the NetLogo engine…");

    const commit = () => {
      commitTimer.current = null;
      if (latest.current) setMetrics(latest.current);
    };

    w.onmessage = (event: MessageEvent) => {
      const message = event.data;
      const s = store.current;
      switch (message.type) {
        case "status":
          setStatus(message.message);
          if (message.message.startsWith("Setting up")) setPhase("setting-up");
          break;
        case "ready": {
          const model = message.settings as Settings;
          const next = {
            ...model,
            "measure-s": settingsRef.current["measure-s"],
          };
          settingsRef.current = next;
          pendingSetup.current = next;
          setSettings(next);
          break;
        }
        case "world":
          s.world = message.world;
          s.worldVersion++;
          s.from = new Float32Array(0);
          s.fromIndex = new Map();
          s.cars = new Float32Array(0);
          s.ticks = -1;
          setWorld(message.world);
          setApplied(pendingSetup.current);
          setPhase("ready");
          setStatus("Ready. Press Go to start the traffic.");
          break;
        case "frame": {
          const now = performance.now();
          const m = message.metrics as Metrics;
          const advanced = m.ticks > s.ticks && s.ticks >= 0;
          if (advanced && !reducedMotion.current) {
            const shown = displayed(s, now);
            const index = new Map<number, number>();
            for (let i = 0; i < shown.length; i += CAR_FIELDS)
              index.set(shown[i], i);
            s.from = shown;
            s.fromIndex = index;
            const gap = s.frameAt ? now - s.frameAt : 100;
            s.duration = message.running
              ? Math.min(
                  1200,
                  Math.max(16, s.duration ? s.duration * 0.6 + gap * 0.4 : gap),
                )
              : 220;
          } else {
            s.from = new Float32Array(0);
            s.fromIndex = new Map();
            s.duration = 0;
          }
          s.cars = message.cars;
          s.frameAt = now;
          s.ticks = m.ticks;
          s.measured = m.measured;
          s.frameVersion++;
          if (message.styles) {
            s.styles = message.styles;
            s.stylesView = message.stylesView;
            s.stylesVersion++;
          }
          latest.current = m;
          if (!message.running) {
            if (commitTimer.current !== null) clearTimeout(commitTimer.current);
            commit();
          } else if (commitTimer.current === null) {
            commitTimer.current = window.setTimeout(commit, 150);
          }
          break;
        }
        case "running":
          setRunning(message.running);
          if (!message.running) {
            if (commitTimer.current !== null) clearTimeout(commitTimer.current);
            commit();
          }
          if (message.reason === "finished")
            setStatus(
              "Measurement window complete. Turn on Run forever or lengthen the window to keep going.",
            );
          else if (message.reason === "paused" && latest.current)
            setStatus("Paused. Press Go to continue.");
          else if (message.running) setStatus("Running. Press Pause to stop.");
          break;
        case "output":
          setOutput((lines) =>
            [...lines, ...message.lines].slice(-MAX_OUTPUT_LINES),
          );
          break;
        case "output-clear":
          setOutput([]);
          break;
        case "notice":
          setStatus(message.message);
          break;
        case "csv":
          csvRequest.current?.(message.text);
          csvRequest.current = null;
          break;
        case "error":
          if (message.fatal) {
            setPhase("error");
            setError(
              "The simulation engine could not load. Check your connection, then reload the engine.",
            );
          } else setError(message.message);
          break;
      }
    };
    w.onerror = (event) => {
      event.preventDefault();
      setPhase("error");
      setRunning(false);
      setError(
        "The simulation engine could not load. Check your connection, then reload the engine.",
      );
    };
    // Draw the streets straight away while the engine loads.
    let cancelled = false;
    const key =
      settingsRef.current["network-source"] === "Schematic Hoddle grid"
        ? "schematic"
        : "osm";
    fetch(`/network-${key}.json`)
      .then((response) => (response.ok ? response.json() : null))
      .then((preview: World | null) => {
        if (!preview || cancelled || store.current.world) return;
        store.current.world = preview;
        store.current.worldVersion++;
        setWorld(preview);
      })
      .catch(() => {});
    w.postMessage({
      type: "init",
      speed,
      settings: {
        ...settingsRef.current,
        "measure-s": forever ? FOREVER : settingsRef.current["measure-s"],
      },
    });
    return () => {
      cancelled = true;
      if (commitTimer.current !== null) clearTimeout(commitTimer.current);
      w.terminate();
      worker.current = null;
    };
    // Settings, speed and forever are read from refs/state at start only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const set = useCallback(
    <K extends SettingName>(name: K, value: Settings[K]) => {
      const next = { ...settingsRef.current, [name]: value };
      settingsRef.current = next;
      setSettings(next);
      if (name === "measure-s" && forever) return;
      send({ type: "set", name, value });
    },
    [send, forever],
  );

  const setForever = useCallback(
    (on: boolean) => {
      setForeverState(on);
      send({
        type: "set",
        name: "measure-s",
        value: on ? FOREVER : settingsRef.current["measure-s"],
      });
    },
    [send],
  );

  const setSpeed = useCallback(
    (value: number) => {
      setSpeedState(value);
      send({ type: "speed", speed: value });
    },
    [send],
  );

  const setup = useCallback(() => {
    pendingSetup.current = settingsRef.current;
    setPhase("setting-up");
    setStatus("Setting up the road network…");
    send({ type: "setup" });
  }, [send]);

  const exportCsv = useCallback(
    () =>
      new Promise<string>((resolve) => {
        csvRequest.current = resolve;
        send({ type: "csv" });
      }),
    [send],
  );

  const setupNeeded = SETUP_ONLY.some(
    (name) => settings[name as SettingName] !== applied[name as SettingName],
  );

  return {
    phase,
    status,
    setStatus,
    error,
    settings,
    world,
    metrics,
    running,
    output,
    speed,
    forever,
    store,
    setupNeeded,
    set,
    setSpeed,
    setForever,
    setup,
    exportCsv,
    run: (on: boolean) => send({ type: "run", run: on }),
    step: () => send({ type: "step" }),
    command: (name: string) => send({ type: "command", name }),
    select: (street: string, block: number) =>
      send({ type: "select", street, block }),
    click: (x: number, y: number) => send({ type: "click", x, y }),
    reload: () => setAttempt((n) => n + 1),
  };
}
