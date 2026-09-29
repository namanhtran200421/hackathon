# Melbourne Traffic Lab web application

Run it locally:

```sh
npm install
npm run dev
```

Open http://localhost:3000. The road network is set up when the page loads. Press **Go** to run the model and **Pause** to stop it. Open **Quick guide** in the header for a step-by-step walkthrough.

## What the page offers

Every widget on the desktop interface of `combined/Melbourne Traffic Combined.nlogox` has a web control:

- **Run bar under the map.** Setup, Go / Pause, Step 1 s, Simulation speed (1× to Max), Run forever, and the elapsed clock with warm-up and measurement progress.
- **Scenario.** Road network, traffic demand (0–12,000 veh/h), through traffic, drivers with live routing, random seed and fixed seed.
- **Road closures.** Street (Choose street), Extent (Choose section), closure type, Apply closure, Reopen selected, Reopen all, Click roads, clicks close the whole street, scheduled closure and its start time. The Selected extent and Closures monitors sit here too.
- **Signals & driving, Routing, Measurement.** Speed limit, cycle length, east–west green share, signal coordination, hook turns, re-route interval, route noise, warm-up and measurement window.
- **View.** Congestion, volume, or change vs baseline, as in the desktop view-mode chooser.
- **Figures, comparison and output.** The desktop monitors plus mean delay and vehicle-hours, a baseline comparison table, Save baseline, Export CSV and the model's output area.
- **Run results.** When the model is paused or stops, a results section summarises the run: trips, throughput, trip time, delay, vehicle-hours, queues and stranded trips. With a baseline saved it compares both runs at the same simulated time and marks each change as better or worse. Charts show cars on the network and mean trip time over time against the baseline, plus the streets whose flow changed most. A street table lists flow, baseline, change, link travel time and closure status. Street flows use the model's `street-flow` definition: vehicles per hour per block, both directions.

Controls tagged **Setup** are read when the network is built, as in the desktop model. The Setup button shows a dot when one of them has changed. Everything else applies while the model runs, including closures.

**Run forever** keeps the model going until you pause. It sets the measurement window to be open-ended, so statistics cover everything after the warm-up. With it off, the model stops at the end of the window, like the desktop version.

## Architecture

Next.js App Router with React and TypeScript. The site is fully static: there is no API route and no server-side simulation.

The combined NetLogo model runs in the browser inside a Web Worker (`public/sim/worker.js`), using the NetLogo Web (Tortoise) engine, the same way NetLogo Web runs models. The worker advances the model tick by tick at the chosen speed and streams car positions, road states and statistics to the page. The page draws the map on a canvas at display frame rate and animates cars between ticks, so movement stays smooth at any speed. The page stays responsive because the model never runs on the main thread.

- `public/sim/tortoise-engine.js` is the NetLogo Web runtime.
- `public/sim/model.js` is the compiled, web-adapted model.
- `public/sim/reporters.js` holds compiled reporters that read state for the page.
- `public/sim/sim-core.js` validates every setting and button and is the only interface the page uses. The browser cannot send arbitrary NetLogo code.

All reads from the model run on a cloned random generator, the same mechanism as `with-local-randomness`. Watching the model at any frame rate or speed therefore never changes its results. Traffic movement, demand, signals, routing, closures, the baseline and Click roads all use the model's own procedures.

`combined/` remains the desktop source. `scripts/prepare-model.py` embeds the cached map and replaces the desktop-only dialogs, file export and drawing with stubs. The web page provides those features itself: native selects replace Choose street and Choose section, the canvas replaces the drawing, and the CSV is built from the model's own values with the desktop column layout.

The web runtime may use a different random sequence from desktop NetLogo. Compare seeds within the same runtime; do not assume web and desktop runs are numerically identical.

The app has no authentication, persistence or server state. The baseline lives in the model in the open tab and is lost on reload. Simulations contain public map data and synthetic vehicles only. The model's limitations in `combined/README.md` still apply.

## Validation

```sh
npm test
npm run typecheck
npm run build
npx playwright test # start npm run dev in another terminal first
npm run format:check
```

Unit tests load the exact browser bundle in Node. They cover the desktop defaults, input validation, results that do not depend on how often the page reads them, reproducibility, vehicle conservation, every closure type, Click roads, scheduled closures, the baseline guards, stopping at the window end, Run forever and the CSV format. Browser tests cover Go, Pause and Step, closures, Click roads, the baseline comparison, CSV download, Run forever, the quick guide, the mobile layout, accessibility and recovery when the engine fails to load.

After editing the desktop model:

```sh
npm run model:build
```

This uses Python's standard library and the vendored compiler in `simulation-runtime/`. No network is needed to compile.

## Deploy

```sh
npx vercel login
npx vercel link --yes --project melbourne-traffic-lab
npx vercel deploy --prod --yes
```

`.vercelignore` excludes desktop assets, the build-time compiler and the raw OSM extract. No secrets or environment variables are required. Any static host works, because the simulation runs in the visitor's browser.

## Credits

Traffic model: the supplied Hoddle Grid/combined Melbourne model, which credits Wilensky's Traffic Grid. NetLogo Web/Tortoise © Uri Wilensky and contributors, GPL-2.0 or later. The licence is served at `/sim/LICENSE.md` and the upstream source is at https://github.com/NetLogo/Tortoise. OSM data © OpenStreetMap contributors, ODbL: https://www.openstreetmap.org/copyright. The app is an educational sandbox, not a calibrated traffic forecast.
