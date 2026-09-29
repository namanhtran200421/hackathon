/*
 * Melbourne Traffic Lab simulation core.
 *
 * Loaded into the same global scope as the NetLogo Web (Tortoise) engine and the
 * compiled combined model: a Web Worker in the browser, a vm context in Node tests.
 * It exposes the desktop model's interface widgets (sliders, switches, choosers and
 * buttons) as a small, validated API. Traffic rules stay in the compiled model.
 */
(function (root) {
  "use strict";

  // The Tortoise compiler bundle normally defines this singleton. The browser only
  // ships the engine, so provide the same identity object the engine compares against.
  if (typeof root.Nobody === "undefined") {
    root.Nobody = {
      id: -1,
      isDead() {
        return true;
      },
      toString() {
        return "nobody";
      },
      getBreedName() {
        return "nobody";
      },
      ask() {},
    };
  }

  // measure-s value used for "Run forever": the measurement window never closes.
  const FOREVER = 1e9;

  // Every slider, switch and chooser on the desktop interface.
  const SETTINGS = {
    "network-source": {
      type: "choice",
      options: ["Real OSM map", "Schematic Hoddle grid"],
    },
    "demand-veh-per-hour": { type: "number", min: 0, max: 12000, int: true },
    "through-traffic-%": { type: "number", min: 0, max: 100, int: true },
    "informed-drivers-%": { type: "number", min: 0, max: 100, int: true },
    "speed-limit-kmh": { type: "number", min: 20, max: 60, int: true },
    "cycle-length": { type: "number", min: 40, max: 150, int: true },
    "ew-green-share": { type: "number", min: 20, max: 80, int: true },
    "warm-up-s": { type: "number", min: 0, max: 900, int: true },
    "measure-s": { type: "number", min: 60, max: FOREVER, int: true },
    seed: { type: "number", min: 1, max: 100, int: true },
    "reroute-interval": { type: "number", min: 10, max: 300, int: true },
    "route-noise": { type: "number", min: 0, max: 0.5 },
    "fixed-seed?": { type: "boolean" },
    "hook-turns?": { type: "boolean" },
    "close-whole-street?": { type: "boolean" },
    "signal-coordination": {
      type: "choice",
      options: ["random offsets", "green wave (east-west)"],
    },
    "view-mode": {
      type: "choice",
      options: ["congestion", "volume", "change vs baseline"],
    },
    "closure-type": {
      type: "choice",
      options: [
        "Both directions",
        "East / north direction",
        "One lane each direction",
      ],
    },
    "scheduled-closure?": { type: "boolean" },
    "closure-start-min": { type: "number", min: 0, max: 60, int: true },
  };

  // Observer buttons that take no input. Choose street / section are native selects.
  const COMMANDS = [
    "setup",
    "go",
    "close-selection",
    "reopen-selection",
    "reopen-all",
    "save-baseline",
    "clear-baseline",
  ];

  const STYLE_FIELDS = 9;
  const CAR_FIELDS = 5;
  const CSV_HEADER =
    "street,direction,block,from,to,lanes,lanes_open,closed,veh_per_hour,baseline_veh_per_hour,change_veh_per_hour,mean_travel_time_s";

  function validate(name, value) {
    const spec = SETTINGS[name];
    if (!spec) throw new Error(`Unknown setting: ${name}`);
    if (spec.type === "boolean") {
      if (typeof value !== "boolean")
        throw new Error(`${name} must be on or off.`);
      return value;
    }
    if (spec.type === "choice") {
      if (!spec.options.includes(value))
        throw new Error(`${name} has no option ${value}.`);
      return value;
    }
    const number = Number(value);
    if (!Number.isFinite(number)) throw new Error(`${name} must be a number.`);
    const clamped = Math.min(spec.max, Math.max(spec.min, number));
    return spec.int ? Math.round(clamped) : clamped;
  }

  function createTrafficSim() {
    const reporters = root.TRAFFIC_REPORTERS;
    const procedures = root.ProcedurePrims;
    const observer = root.world.observer;
    // Reads run on a cloned random generator, so watching the model (at any
    // frame rate) never changes its results. This mirrors with-local-randomness.
    const read = (reporter) => root.workspace.rng.withClone(reporter);
    const ticks = () => root.world.ticker.tickCount();
    let world = null;

    function settings() {
      const out = {};
      for (const name of Object.keys(SETTINGS))
        out[name] = observer.getGlobal(name);
      return out;
    }

    function metrics() {
      const m = read(reporters.metrics);
      const summary = m[17];
      return {
        ticks: m[0],
        cars: m[1],
        generated: m[2],
        completedTotal: m[3],
        stranded: m[4],
        waiting: m[5],
        meanTrip: m[6],
        meanDelay: m[7],
        measured: m[8],
        completed: m[9],
        vehicleHours: m[10],
        finished: m[11] === true,
        closureDesc: String(m[12]),
        selectionLabel: String(m[13]),
        measuring: m[14] === true,
        hasBaseline: m[15] === true,
        baselineMatches: m[16] === true,
        baseline:
          Array.isArray(summary) && summary.length === 5
            ? {
                completed: summary[0],
                meanTrip: summary[1],
                waiting: summary[2],
                stranded: summary[3],
                measured: summary[4],
              }
            : null,
        selectedStreet: String(m[18]),
        selectedBlock: Number(m[19]) || 0,
        warmUp: m[20],
        measure: m[21],
      };
    }

    function cars() {
      const list = read(reporters.cars);
      const out = new Float32Array(list.length * CAR_FIELDS);
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        for (let j = 0; j < CAR_FIELDS; j++)
          out[i * CAR_FIELDS + j] = typeof c[j] === "number" ? c[j] : 0;
      }
      return out;
    }

    function styles() {
      const list = read(reporters.styles);
      const out = new Float32Array(list.length * STYLE_FIELDS);
      for (let i = 0; i < list.length; i++) {
        const s = list[i];
        const o = i * STYLE_FIELDS;
        out[o] = typeof s[0] === "number" ? s[0] : 5;
        out[o + 1] = s[1];
        out[o + 2] = s[2] ? 1 : 0;
        out[o + 3] = s[3];
        out[o + 4] = s[4];
        out[o + 5] = s[5];
        out[o + 6] = s[6];
        out[o + 7] = s[7] ? 1 : 0;
        out[o + 8] = s[8] ? 1 : 0;
      }
      return out;
    }

    function describeWorld() {
      const roads = read(reporters.roads).map((r, index) => ({
        index,
        from: r[0],
        to: r[1],
        street: String(r[2]),
        section: r[3],
        geometry: r[4].map((p) => [p[0], p[1]]),
        lanes: r[5],
        kind: String(r[6]),
        direction: String(r[7]),
        carsAllowed: r[8] === true,
      }));
      const nodes = read(reporters.nodes).map((n) => ({
        x: n[0],
        y: n[1],
        kind: String(n[2]),
        label: String(n[3]),
      }));
      const labels = read(reporters.labels)
        .map((l) => ({ x: l[0], y: l[1], text: String(l[2]) }))
        .filter((l) => l.text && !l.text.startsWith("©"));
      if (!labels.length) {
        // Schematic grid: the desktop background names streets along the
        // west edge (east-west streets) and the north edge (north-south).
        const extents = new Map();
        for (const r of roads) {
          if (r.kind !== "main" && r.kind !== "little") continue;
          const e = extents.get(r.street) || {
            minX: Infinity,
            maxX: -Infinity,
            minY: Infinity,
            maxY: -Infinity,
          };
          for (const [x, y] of r.geometry) {
            e.minX = Math.min(e.minX, x);
            e.maxX = Math.max(e.maxX, x);
            e.minY = Math.min(e.minY, y);
            e.maxY = Math.max(e.maxY, y);
          }
          extents.set(r.street, e);
        }
        for (const [text, e] of extents) {
          const eastWest = e.maxX - e.minX >= e.maxY - e.minY;
          labels.push(
            eastWest
              ? { x: e.minX + 1, y: (e.minY + e.maxY) / 2, text, align: "left" }
              : { x: (e.minX + e.maxX) / 2, y: e.maxY, text, align: "center" },
          );
        }
      }
      const b = read(reporters.bounds);
      // Same list the desktop Choose street dialog offers.
      const streets = [
        ...new Set(
          roads
            .filter(
              (r) => r.kind !== "gate" && r.kind !== "access" && r.carsAllowed,
            )
            .map((r) => r.street),
        ),
      ].sort();
      world = {
        network: observer.getGlobal("network-source"),
        roads,
        nodes,
        labels,
        streets,
        bounds: { minX: b[0], maxX: b[1], minY: b[2], maxY: b[3] },
      };
      return world;
    }

    return {
      FOREVER,
      CAR_FIELDS,
      STYLE_FIELDS,
      settings,
      set(name, value) {
        observer.setGlobal(name, validate(name, value));
      },
      select(street, block) {
        if (typeof street !== "string" || street.length > 100)
          throw new Error("Choose a street from the list.");
        if (world && !world.streets.includes(street))
          throw new Error(`${street} is not a drivable street on this map.`);
        const section = Math.max(0, Math.min(2000, Math.round(Number(block))));
        if (!Number.isFinite(section)) throw new Error("Choose a section.");
        observer.setGlobal("selected-street", street);
        observer.setGlobal("selected-block", section);
      },
      setup() {
        procedures.callCommand("setup");
        return describeWorld();
      },
      command(name) {
        if (!COMMANDS.includes(name))
          throw new Error(`Unknown button: ${name}`);
        if (name === "setup") return this.setup();
        procedures.callCommand(name);
      },
      // One press of Go / Step. Returns false when the model stops itself
      // (end of the measurement window), like a forever button popping up.
      tick() {
        const before = ticks();
        procedures.callCommand("go");
        return ticks() > before;
      },
      // Click roads: the model's own pointer handler picks and toggles the road.
      click(x, y) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        procedures.callCommand("handle-map-pointer", true, true, x, y);
        procedures.callCommand("handle-map-pointer", false, true, x, y);
      },
      // Recolour roads now (e.g. after changing view-mode while paused).
      refreshColors() {
        read(() => procedures.callCommand("update-link-colors"));
      },
      ticks,
      metrics,
      cars,
      styles,
      world: () => world,
      describeWorld,
      csv() {
        const rows = read(reporters.csv);
        return [CSV_HEADER, ...rows.map(String)].join("\n") + "\n";
      },
      // The model's baseline, for browser storage: link flows, summary, signature.
      exportBaseline() {
        const [pairs, summary, signature] = read(reporters.baseline);
        if (!Array.isArray(signature)) return null;
        return JSON.parse(JSON.stringify({ pairs, summary, signature }));
      },
      restoreBaseline(saved) {
        if (!saved || !Array.isArray(saved.pairs) || !Array.isArray(saved.signature)) return;
        const pairs = saved.pairs
          .filter((kv) => Array.isArray(kv) && typeof kv[0] === "string" && Number.isFinite(kv[1]))
          .slice(0, 20000);
        const summary = Array.isArray(saved.summary) ? saved.summary.filter(Number.isFinite).slice(0, 5) : [];
        const signature = saved.signature
          .filter((v) => ["string", "number", "boolean"].includes(typeof v))
          .slice(0, 32);
        read(() => procedures.callCommand("restore-baseline", pairs, summary, signature));
      },
      conserved() {
        return read(reporters.conservation) === true;
      },
    };
  }

  root.TRAFFIC_SETTINGS = SETTINGS;
  root.createTrafficSim = createTrafficSim;
})(typeof self !== "undefined" ? self : globalThis);
