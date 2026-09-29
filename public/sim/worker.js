/*
 * Runs the combined NetLogo model in a Web Worker, like NetLogo Web.
 * The page sends widget changes and button presses; the worker streams every
 * tick batch back so the map can animate smoothly without blocking the page.
 */
"use strict";

// The NetLogo Web engine was written for pages and refers to window.
self.window = self;
// NetLogo Web warns that `display` is unimplemented each time a closure changes
// the network. The web map redraws on its own, so hide that one message.
const warn = console.warn.bind(console);
console.warn = (...args) => {
  if (String(args[0]).includes("has not yet been implemented")) return;
  warn(...args);
};

let output = [];
function post(message, transfer) {
  self.postMessage(message, transfer || []);
}
function flushOutput() {
  if (!output.length) return;
  const text = output.join("");
  output = [];
  post({ type: "output", lines: text.split("\n").filter(Boolean) });
}
self.modelConfig = {
  output: {
    write: (text) => output.push(String(text)),
    clear: () => {
      output = [];
      post({ type: "output-clear" });
    },
  },
  print: { write: (text) => output.push(String(text)) },
  // user-message in the model (for example Save baseline's guards).
  dialog: {
    notify: (message) => post({ type: "notice", message: String(message) }),
    confirm: (message) => {
      post({ type: "notice", message: String(message) });
      return true;
    },
    yesOrNo: () => true,
    input: () => "",
  },
};

let sim = null;
let running = false;
let speed = 20; // simulated seconds per real second; 0 = as fast as possible
let owed = 0;
let last = 0;
let timer = null;
let stylesDirty = true;
let lastStyleBucket = -1;

function frame() {
  const metrics = sim.metrics();
  const cars = sim.cars();
  const message = { type: "frame", running, metrics, cars };
  const transfer = [cars.buffer];
  // The model recolours roads every 5 ticks; send styles when they change.
  const bucket = Math.floor(metrics.ticks / 5);
  if (stylesDirty || bucket !== lastStyleBucket) {
    const styles = sim.styles();
    message.styles = styles;
    message.stylesView = sim.settings()["view-mode"];
    transfer.push(styles.buffer);
    stylesDirty = false;
    lastStyleBucket = bucket;
  }
  post(message, transfer);
}

function setRunning(next, reason) {
  if (running === next) return;
  running = next;
  if (timer !== null) clearTimeout(timer);
  timer = null;
  if (running) {
    owed = speed === 0 ? 0 : 1; // start moving immediately
    last = performance.now();
    timer = setTimeout(loop, 0);
  }
  post({ type: "running", running, reason: reason || null });
}

function loop() {
  timer = null;
  if (!running) return;
  const now = performance.now();
  if (speed > 0) {
    owed = Math.min(owed + ((now - last) / 1000) * speed, Math.max(2, speed / 4));
  }
  last = now;
  // Yield often so button presses and slider changes apply between ticks.
  const deadline = now + 30;
  let advanced = 0;
  let stopped = false;
  while (speed === 0 || owed >= 1) {
    if (!sim.tick()) {
      stopped = true;
      break;
    }
    advanced++;
    if (speed > 0) owed -= 1;
    if (performance.now() > deadline) break;
  }
  if (advanced || stopped) frame();
  flushOutput();
  if (stopped) {
    setRunning(false, "finished");
    return;
  }
  const wait = speed === 0 ? 0 : Math.min(250, Math.max(4, ((1 - owed) / speed) * 1000));
  timer = setTimeout(loop, wait);
}

function setup() {
  const world = sim.setup();
  stylesDirty = true;
  post({ type: "world", world });
  frame();
}

function handle(message) {
  switch (message.type) {
    case "init": {
      if (sim) return;
      post({ type: "status", message: "Loading the NetLogo engine…" });
      importScripts("tortoise-engine.js", "sim-core.js", "model.js", "reporters.js");
      sim = self.createTrafficSim();
      for (const [name, value] of Object.entries(message.settings || {}))
        sim.set(name, value);
      if (typeof message.speed === "number") speed = message.speed;
      post({ type: "ready", settings: sim.settings() });
      post({ type: "status", message: "Setting up the road network…" });
      setup();
      return;
    }
    case "set":
      sim.set(message.name, message.value);
      if (message.name === "view-mode") {
        sim.refreshColors();
        stylesDirty = true;
      }
      if (!running) frame();
      return;
    case "select":
      sim.select(message.street, message.block);
      if (!running) frame();
      return;
    case "setup":
      setRunning(false, "setup");
      post({ type: "status", message: "Setting up the road network…" });
      setup();
      return;
    case "run":
      // If the window has ended, the first go stops again, like the desktop button.
      setRunning(Boolean(message.run), message.run ? null : "paused");
      return;
    case "step":
      setRunning(false, "paused");
      if (!sim.tick()) post({ type: "running", running: false, reason: "finished" });
      frame();
      return;
    case "command":
      sim.command(message.name);
      stylesDirty = true;
      if (!running) frame();
      return;
    case "click":
      sim.click(message.x, message.y);
      stylesDirty = true;
      if (!running) frame();
      return;
    case "speed":
      speed = Math.max(0, Math.min(1000, Number(message.speed) || 0));
      owed = Math.min(owed, 1);
      last = performance.now();
      return;
    case "export-baseline":
      post({ type: "baseline", saved: sim.exportBaseline() });
      return;
    case "restore-baseline":
      sim.restoreBaseline(message.saved);
      stylesDirty = true;
      if (!running) frame();
      return;
    case "csv":
      post({ type: "csv", text: sim.csv(), ticks: sim.ticks() });
      return;
  }
}

self.onmessage = (event) => {
  try {
    handle(event.data || {});
  } catch (error) {
    if (running) setRunning(false, "error");
    post({
      type: "error",
      message: error && error.message ? error.message : String(error),
      fatal: !sim,
    });
  } finally {
    flushOutput();
  }
};
