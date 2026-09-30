/**
 * The background worker that runs the traffic model in the browser.
 *
 * The model runs here, on its own thread, so the page stays smooth; NetLogo
 * Web runs models the same way. The page sends messages such as "start",
 * "move this slider" or "close this street". The worker runs the model second
 * by second at the chosen speed and sends back car positions, road colours and
 * the latest numbers.
 *
 * `npm run build -w @traffic-lab/simulation` bundles this file into
 * runtime/worker.js, next to the engine files it loads.
 */

import { createTrafficSim, type TrafficSim } from "./createTrafficSim";
import { installNobody, type ModelConfig, type ModelScope } from "./modelScope";
import type { PageMessage, RunReason, WorkerMessage } from "./protocol";

declare const self: DedicatedWorkerGlobalScope & { window?: unknown; modelConfig?: ModelConfig };

// The NetLogo Web engine was written for web pages and expects `window`.
self.window = self;

// NetLogo Web warns that `display` is not implemented every time a road
// closes. The page redraws the map by itself, so hide just that warning.
const originalWarn = console.warn.bind(console);
console.warn = function (...details: unknown[]) {
  if (String(details[0]).includes("has not yet been implemented")) {
    return;
  }
  originalWarn(...details);
};

/** Send a message to the page. Number arrays are moved, not copied. */
function post(message: WorkerMessage, transfer?: Transferable[]): void {
  self.postMessage(message, transfer || []);
}

// Text the model prints, collected and sent to the page in batches.
let printed: string[] = [];

function sendPrintedLines(): void {
  if (printed.length === 0) {
    return;
  }
  const lines = printed.join("").split("\n").filter(Boolean);
  printed = [];
  post({ type: "output", lines: lines });
}

// How the model prints and shows pop-up messages (for example when Save
// baseline is refused).
self.modelConfig = {
  output: {
    write: function (text) {
      printed.push(String(text));
    },
    clear: function () {
      printed = [];
      post({ type: "output-clear" });
    },
  },
  print: {
    write: function (text) {
      printed.push(String(text));
    },
  },
  dialog: {
    notify: function (message) {
      post({ type: "notice", message: String(message) });
    },
    confirm: function (message) {
      post({ type: "notice", message: String(message) });
      return true;
    },
    yesOrNo: function () {
      return true;
    },
    input: function () {
      return "";
    },
  },
};

let simulation: TrafficSim | null = null;
let running = false;
let speed = 20; // simulated seconds per real second; 0 means as fast as possible
let secondsOwed = 0; // simulated seconds that are due but not yet run
let lastLoop = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let roadsChanged = true;
let lastColourUpdate = -1;

/** The loaded model. Messages only arrive after "init", so it always exists. */
function model(): TrafficSim {
  if (simulation === null) {
    throw new Error("The simulator has not loaded yet.");
  }
  return simulation;
}

/** Send the latest car positions and numbers, and road colours when they change. */
function sendFrame(): void {
  const sim = model();
  const metrics = sim.metrics();
  const cars = sim.cars();
  const message: WorkerMessage & { type: "frame" } = {
    type: "frame",
    running: running,
    metrics: metrics,
    cars: cars,
  };
  const transfer: Transferable[] = [cars.buffer];

  // The model recolours the roads every 5 seconds.
  const colourUpdate = Math.floor(metrics.ticks / 5);
  if (roadsChanged || colourUpdate !== lastColourUpdate) {
    const styles = sim.styles();
    message.styles = styles;
    message.stylesView = sim.settings()["view-mode"];
    message.sites = sim.siteVolumes();
    transfer.push(styles.buffer);
    roadsChanged = false;
    lastColourUpdate = colourUpdate;
  }
  post(message, transfer);
}

/** Start or stop the run loop, and tell the page why. */
function setRunning(shouldRun: boolean, reason: RunReason | null): void {
  if (running === shouldRun) {
    return;
  }
  running = shouldRun;
  if (timer !== null) {
    clearTimeout(timer);
  }
  timer = null;
  if (running) {
    // Start moving straight away.
    if (speed === 0) {
      secondsOwed = 0;
    } else {
      secondsOwed = 1;
    }
    lastLoop = performance.now();
    timer = setTimeout(runLoop, 0);
  }
  post({ type: "running", running: running, reason: reason });
}

/**
 * One turn of the run loop. Runs as many simulated seconds as the chosen speed
 * asks for, but hands control back after about 30 ms so button presses and
 * slider changes are handled quickly.
 */
function runLoop(): void {
  timer = null;
  if (!running) {
    return;
  }
  const sim = model();
  const now = performance.now();
  if (speed > 0) {
    const due = secondsOwed + ((now - lastLoop) / 1000) * speed;
    secondsOwed = Math.min(due, Math.max(2, speed / 4));
  }
  lastLoop = now;

  const deadline = now + 30;
  let advanced = 0;
  let stopped = false;
  while (speed === 0 || secondsOwed >= 1) {
    if (!sim.tick()) {
      stopped = true;
      break;
    }
    advanced = advanced + 1;
    if (speed > 0) {
      secondsOwed = secondsOwed - 1;
    }
    if (performance.now() > deadline) {
      break;
    }
  }

  if (advanced > 0 || stopped) {
    sendFrame();
  }
  sendPrintedLines();
  if (stopped) {
    setRunning(false, "finished");
    return;
  }

  // Sleep until the next simulated second is due.
  let wait = 0;
  if (speed > 0) {
    wait = Math.min(250, Math.max(4, ((1 - secondsOwed) / speed) * 1000));
  }
  timer = setTimeout(runLoop, wait);
}

/** Press Setup and send the new road layout to the page. */
function buildNetwork(): void {
  const world = model().setup();
  roadsChanged = true;
  post({ type: "world", world: world });
  sendFrame();
}

/** Load the engine and model, apply the page's settings and build the map. */
function start(message: PageMessage & { type: "init" }): void {
  if (simulation) {
    return;
  }
  post({ type: "status", phase: "loading", message: "Loading the simulator…" });
  installNobody(self);
  importScripts("tortoise-engine.js", "model.js", "reporters.js");
  const sim = createTrafficSim(self as unknown as ModelScope);
  simulation = sim;
  Object.entries(message.settings).forEach(function (entry) {
    sim.set(entry[0], entry[1]);
  });
  speed = message.speed;
  post({ type: "ready", settings: sim.settings() });
  post({ type: "status", phase: "building", message: "Building the road map…" });
  buildNetwork();
}

/** Handle one message from the page. */
function handle(message: PageMessage): void {
  if (message.type === "init") {
    start(message);
    return;
  }
  const sim = model();
  if (message.type === "set") {
    sim.set(message.name, message.value);
    if (message.name === "view-mode") {
      sim.refreshColors();
      roadsChanged = true;
    }
    if (!running) {
      sendFrame();
    }
  } else if (message.type === "select") {
    sim.select(message.street, message.block);
    if (!running) {
      sendFrame();
    }
  } else if (message.type === "setup") {
    setRunning(false, "setup");
    post({ type: "status", phase: "building", message: "Building the road map…" });
    buildNetwork();
  } else if (message.type === "run") {
    // If the counting time is over, the model stops again straight away, just
    // like the desktop Go button.
    if (message.run) {
      setRunning(true, null);
    } else {
      setRunning(false, "paused");
    }
  } else if (message.type === "step") {
    setRunning(false, "paused");
    if (!sim.tick()) {
      post({ type: "running", running: false, reason: "finished" });
    }
    sendFrame();
  } else if (message.type === "command") {
    sim.command(message.name);
    roadsChanged = true;
    if (!running) {
      sendFrame();
    }
  } else if (message.type === "click") {
    sim.click(message.x, message.y);
    roadsChanged = true;
    if (!running) {
      sendFrame();
    }
  } else if (message.type === "speed") {
    speed = Math.max(0, Math.min(1000, Number(message.speed) || 0));
    secondsOwed = Math.min(secondsOwed, 1);
    lastLoop = performance.now();
  } else if (message.type === "export-baseline") {
    post({ type: "baseline", saved: sim.exportBaseline() });
  } else if (message.type === "restore-baseline") {
    sim.restoreBaseline(message.saved);
    roadsChanged = true;
    if (!running) {
      sendFrame();
    }
  } else if (message.type === "csv") {
    post({ type: "csv", text: sim.csv(), ticks: sim.ticks() });
  }
}

self.onmessage = function (event: MessageEvent<PageMessage>) {
  try {
    handle(event.data);
  } catch (error) {
    if (running) {
      setRunning(false, "error");
    }
    let text = String(error);
    if (error instanceof Error) {
      text = error.message;
    }
    // Without a model, the engine itself failed to load.
    post({ type: "error", message: text, fatal: simulation === null });
  } finally {
    sendPrintedLines();
  }
};
