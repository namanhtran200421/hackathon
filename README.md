# Melbourne Traffic Lab

Close a street in Melbourne's CBD and watch the traffic find another way.

Melbourne Traffic Lab is a traffic simulation of Melbourne's city centre. It runs in your web browser: the streets come from OpenStreetMap, cars arrive at the edges of the city, drive to their destinations, wait at traffic lights and look for detours when a road is closed. You can close any street, watch what happens, and compare the result with normal traffic.

The simulation is a NetLogo model that our team built. The same model runs on the desktop in NetLogo and on the web page.

## Try it

You need [Node.js](https://nodejs.org) 22 or newer.

```sh
npm install
npm run dev
```

Then open http://localhost:3000.

The road map is ready when the page loads. Press **Start** to set the traffic moving. The **Quick guide** button at the top of the page explains everything else in six short steps.

## What you can do

- **Change the traffic.** Set how many cars arrive each hour, how many are just passing through, and how many drivers use live traffic information to avoid jams.
- **Close streets.** Pick a street and close it in both directions, in one direction, or by one lane. You can also click roads on the map to close and reopen them. Closures work while the traffic is moving.
- **Watch it live.** The map shows every car. Colour the roads by traffic jams, by traffic volume, or by the change from normal traffic. Zoom in with the + button, or hold Ctrl and scroll.
- **Run as long as you like.** The simulation normally stops after its counting time. Turn on **Keep running** to let it go until you press Pause.
- **Compare with normal traffic.** Record a baseline once, with every road open. Every later run is compared with it: a summary table, charts over time, and the streets that changed most. The baseline is kept in your browser, so it survives a reload.
- **Download the numbers.** Download CSV saves the traffic on every road in the same format as the desktop model.

Every button, slider and switch from the desktop NetLogo model has a matching control on the page.

## How it works

The project is a small monorepo with three parts, all written in TypeScript:

1. **The simulation** (`packages/simulation`). The NetLogo model, the map data and the tools that build it, plus the TypeScript code that runs the model in the browser. The web page runs the same model with NetLogo Web, the engine behind netlogoweb.org.
2. **The server** (`apps/server`). A small Express server. It sends the web page and the simulation files to the browser, answers a health check and serves the two road maps. It adds security headers and compresses large files. It does not need a database.
3. **The web page** (`apps/web`). A React page, built with Vite. The simulation runs in a background worker inside the browser, so the page stays smooth. The map is drawn on a canvas that refreshes 60 times a second and slides each car between its positions.

Because the traffic is calculated in each visitor's browser, the server does very little work and one small server can handle many visitors.

## Project layout

```
apps/
  server/                   Express server
    src/index.ts              Starts the server
    src/app.ts                Puts the pieces together
    src/config.ts             Port, mode and folders
    src/middleware/           Security headers, caching, error pages
    src/routes/               The API and the web page
    test/                     Server tests
  web/                      React page
    src/main.tsx              Starts the page
    src/app/                  The page layout
    src/components/           Shared pieces: page frame, form controls
    src/features/             One folder per part of the page:
      simulation/               talking to the simulator
      map/                      the live map and run bar
      settings/                 the settings panel and closures
      figures/                  the yellow number tiles
      baseline/                 saving and comparing with normal traffic
      results/                  results tables and charts
      log/                      the simulation log
      guide/                    the quick guide
    src/lib/                  Number and time formatting
    src/styles/               Colours and layout, one file per part
packages/
  simulation/               Everything about the traffic model
    src/                      Settings, data types, messages, and the code
                              that controls the model in the browser and Node
    runtime/                  Files the browser loads from /sim
    build/                    Turns the NetLogo model into JavaScript
    netlogo/                  The desktop NetLogo model, its code, map data,
                              the team's original models and build tools
    test/                     Simulation tests
e2e/                        Browser tests of the whole site
docs/design.md              How the page looks and behaves
```

The simulation package has its own [README](packages/simulation/README.md) with details about the model.

## Commands

Run these from the project folder.

| Command                 | What it does                                                   |
| ----------------------- | -------------------------------------------------------------- |
| `npm run dev`           | Start the site with live reloading while you edit the code     |
| `npm run build`         | Build the simulation worker, the web page and the server       |
| `npm start`             | Start the production site (run `npm run build` first)          |
| `npm test`              | Test the simulation and the server                             |
| `npm run test:e2e`      | Test the site in a real browser (builds and starts it for you) |
| `npm run typecheck`     | Check the TypeScript types                                     |
| `npm run lint`          | Check the code for mistakes and house style                    |
| `npm run format`        | Tidy the code layout                                           |
| `npm run model:web`     | Rebuild the browser model after changing the NetLogo model     |
| `npm run model:desktop` | Rebuild the desktop model file from its code                   |
| `npm run model:map`     | Rebuild the road map from the OpenStreetMap data               |

The first time you run the browser tests, install a test browser with `npx playwright install chromium`. The model commands need Python 3; they do not need an internet connection.

## Putting it online

Run it on any host that supports Node.js:

```sh
npm install
npm run build
npm start
```

The server listens on the port in the `PORT` environment variable, or 3000. It needs no secrets and no database. Put it behind HTTPS, as most hosts do by default. `/api/health` answers `{"status":"ok"}` for health checks.

## Writing code for this project

The code is TypeScript, written to be easy to read:

- Use `if` and `else` rather than the `? :` operator.
- Use `function () {}` rather than arrow functions.
- Start every file with a short comment saying what it is for.
- Keep each feature of the page in its own folder under `apps/web/src/features`.
- The page talks to the model only through `packages/simulation/src/createTrafficSim.ts`, which checks every input.

`npm run lint` checks the first two rules, `npm run typecheck` checks the types, and `npm run format` handles the layout.

## Limits

This is a model for exploring ideas, not a traffic forecast or a safety assessment. The streets are real, but the number of cars, where they go and the traffic light timings are made up. There are no trams, buses, bikes or pedestrians. Results from the web page and from desktop NetLogo may differ slightly because the two use different random number generators; compare runs within the same one.

## Credits

The traffic model builds on our groupmate's Hoddle Grid prototype, which credits Wilensky's NetLogo Traffic Grid (2003). The web page runs it with NetLogo Web (Tortoise) by Uri Wilensky and contributors, under the GPL (see `packages/simulation/runtime/LICENSE.md` and https://github.com/NetLogo/Tortoise). Map data © OpenStreetMap contributors, available under the Open Database Licence: https://www.openstreetmap.org/copyright.
