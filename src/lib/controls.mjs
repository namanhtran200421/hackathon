// Web controls for every widget on the desktop NetLogo interface.
// Defaults must match the model; tests/simulation.test.mjs checks them.

/** measure-s used by "Run forever": the measurement window never closes. */
export const FOREVER = 1e9;

export const DEFAULTS = {
  "network-source": "Real OSM map",
  "demand-veh-per-hour": 2500,
  "through-traffic-%": 50,
  "informed-drivers-%": 50,
  "speed-limit-kmh": 40,
  "cycle-length": 80,
  "ew-green-share": 50,
  "warm-up-s": 60,
  "measure-s": 600,
  seed: 42,
  "reroute-interval": 60,
  "route-noise": 0.1,
  "fixed-seed?": true,
  "hook-turns?": false,
  "close-whole-street?": true,
  "signal-coordination": "random offsets",
  "view-mode": "congestion",
  "closure-type": "Both directions",
  "scheduled-closure?": false,
  "closure-start-min": 2,
};

/** Sliders, with the desktop ranges and steps. */
export const SLIDERS = {
  "demand-veh-per-hour": {
    label: "Traffic demand",
    min: 0,
    max: 12000,
    step: 250,
    unit: "veh/h",
  },
  "through-traffic-%": {
    label: "Through traffic",
    min: 0,
    max: 100,
    step: 5,
    unit: "%",
    help: "Share of trips that cross the CBD from one boundary gate to another.",
  },
  "informed-drivers-%": {
    label: "Drivers with live routing",
    min: 0,
    max: 100,
    step: 5,
    unit: "%",
    help: "Informed drivers re-route around congestion and closures.",
  },
  "speed-limit-kmh": {
    label: "Speed limit",
    min: 20,
    max: 60,
    step: 5,
    unit: "km/h",
  },
  "cycle-length": {
    label: "Signal cycle length",
    min: 40,
    max: 150,
    step: 5,
    unit: "s",
  },
  "ew-green-share": {
    label: "East–west green share",
    min: 20,
    max: 80,
    step: 5,
    unit: "%",
  },
  "warm-up-s": {
    label: "Warm-up",
    min: 0,
    max: 900,
    step: 30,
    unit: "s",
    help: "Trips are not measured until the network has filled.",
  },
  "measure-s": {
    label: "Measurement window",
    min: 60,
    max: 3600,
    step: 60,
    unit: "s",
  },
  seed: { label: "Random seed", min: 1, max: 100, step: 1, unit: "" },
  "reroute-interval": {
    label: "Re-route interval",
    min: 10,
    max: 300,
    step: 10,
    unit: "s",
    help: "How often live travel times are recalculated.",
  },
  "route-noise": {
    label: "Route noise",
    min: 0,
    max: 0.5,
    step: 0.05,
    unit: "",
    help: "Randomness in each driver's route choice.",
  },
  "closure-start-min": {
    label: "Closure starts at",
    min: 0,
    max: 60,
    step: 1,
    unit: "min",
  },
};

export const CHOICES = {
  "network-source": [
    ["Real OSM map", "Real OSM map"],
    ["Schematic Hoddle grid", "Schematic Hoddle grid"],
  ],
  "signal-coordination": [
    ["random offsets", "Random offsets"],
    ["green wave (east-west)", "Green wave (east–west)"],
  ],
  "view-mode": [
    ["congestion", "Congestion"],
    ["volume", "Volume"],
    ["change vs baseline", "Change vs baseline"],
  ],
  "closure-type": [
    ["Both directions", "Both directions"],
    ["East / north direction", "East / north direction only"],
    ["One lane each direction", "One lane each direction"],
  ],
};

/** Controls the model reads in Setup. Changing them marks Setup as needed. */
export const SETUP_ONLY = [
  "network-source",
  "seed",
  "fixed-seed?",
  "speed-limit-kmh",
  "cycle-length",
  "ew-green-share",
  "signal-coordination",
];

/** Simulated seconds per real second. 0 runs as fast as the engine can. */
export const SPEEDS = [1, 2, 5, 10, 20, 30, 60, 0];
export const DEFAULT_SPEED = 20;
