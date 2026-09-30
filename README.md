# Melbourne Traffic Lab

Close a street in Melbourne's CBD and watch the traffic find another way.

Melbourne Traffic Lab is a traffic simulation of Melbourne's city centre. It runs in your web browser on real data: the streets and car parks come from OpenStreetMap, the traffic lights stand where Victoria's Department of Transport and Planning (DTP) lists them, and the traffic itself comes from the SCATS counts at the city's traffic lights. Choose a weekday or weekend and a time of day, and cars enter where real roads cross into the city, drive to where they are going, wait at traffic lights and look for detours when a road is closed. You can close any street, watch what happens, and compare the result with normal traffic at that time.

The simulation is a NetLogo model that our team built. The same model runs on the desktop in NetLogo and on the web page.

## Try it

You need [Node.js](https://nodejs.org) 22 or newer.

```sh
npm install
npm run dev
```

Then open http://localhost:3000.

The road map is ready when the page loads, set to a weekday from 8 am. Press **Start** to set the traffic moving. The **Quick guide** button at the top of the page explains everything else in seven short steps.

## What you can do

- **Choose the day and time.** Pick a weekday or a weekend day and any quarter-hour to start counting. The number of trips, and where they start and end, follow the real SCATS counts for that time, and change as the clock moves on.
- **See how real it is.** The page shows how closely the simulated traffic matches the SCATS counts at the counted intersections, and the results list every one of them.
- **Change how drivers behave.** Set how many drivers use live traffic information to avoid jams, and how the traffic lights are timed.
- **Close streets.** Pick a street and close it in both directions, in one direction, or by one lane. You can also click roads on the map to close and reopen them. Closures work while the traffic is moving.
- **Watch it live.** The map shows every car. Colour the roads by traffic jams, by traffic volume, or by the change from normal traffic. Zoom in with the + button, or hold Ctrl and scroll.
- **Run as long as you like.** The simulation normally stops after its counting time. Turn on **Keep running** to let it go until you press Pause.
- **Compare with normal traffic.** Record a baseline once, with every road open. Every later run is compared with it: a summary table, charts over time, and the streets that changed most. The baseline is kept in your browser, so it survives a reload.
- **Download the numbers.** Download CSV saves the traffic on every road in the same format as the desktop model.

Every button, slider and switch from the desktop NetLogo model has a matching control on the page.

## How it works

There is no backend. The whole traffic model runs in your browser, so the site is a React page plus a set of static files, and any static host can serve it.

The project has two parts, both written in TypeScript:

1. **The simulation** (`simulation/`). The NetLogo model, the map data and the tools that build it, plus the code that runs the model in the browser. The page runs the same model as desktop NetLogo, using NetLogo Web (the engine behind netlogoweb.org).
2. **The front end** (`frontend/`). A React page built with Vite. The model runs in a background worker inside the browser, so the page stays smooth. The map is drawn on a canvas that refreshes 60 times a second and slides each car between its positions.

## Project layout

```
frontend/                   The web page (React + Vite)
  src/main.tsx                Starts the page
  src/app/                    The page layout
  src/components/             Shared pieces: page frame, form controls
  src/features/               One folder per part of the page:
    simulation/                 talking to the model in the background worker
    map/                        the live map and run bar
    settings/                   the settings panel and closures
    figures/                    the yellow number tiles
    baseline/                   saving and comparing with normal traffic
    results/                    results tables and charts
    log/                        the simulation log
    guide/                      the quick guide
  src/lib/                    Number and time formatting
  src/styles/                 Colours and layout, one file per part
  vite/                       Build helpers: the /sim files and security headers
  test/                       Front-end tests
simulation/                 Everything about the traffic model
  src/                        Settings, data types, messages, and the code
                              that controls the model in the browser and Node
  runtime/                    Files the browser loads from /sim
  build/                      Turns the NetLogo model into JavaScript
  netlogo/                    The desktop NetLogo model, its code, map data,
                              the team's original models and build tools
  test/                       Simulation tests
e2e/                        Browser tests of the whole site
docs/design.md              How the page looks and behaves
vercel.json                 How Vercel builds and serves the site
```

The simulation folder has its own [README](simulation/README.md) with details about the model.

## Commands

Run these from the project folder.

| Command                 | What it does                                                   |
| ----------------------- | -------------------------------------------------------------- |
| `npm run dev`           | Start the site with live reloading while you edit the code     |
| `npm run build`         | Build the site into `frontend/dist`                            |
| `npm start`             | Serve the built site locally, with the same headers as Vercel  |
| `npm test`              | Test the simulation and the security headers                   |
| `npm run test:e2e`      | Test the site in a real browser (builds and starts it for you) |
| `npm run typecheck`     | Check the TypeScript types                                     |
| `npm run lint`          | Check the code for mistakes and house style                    |
| `npm run format`        | Tidy the code layout                                           |
| `npm run model:web`     | Rebuild the browser model after changing the NetLogo model     |
| `npm run model:desktop` | Rebuild the desktop model file from its code                   |
| `npm run model:map`     | Rebuild the road map from the OpenStreetMap data               |
| `npm run model:data`    | Rebuild the real traffic from the SCATS counts and the map     |

The first time you run the browser tests, install a test browser with `npx playwright install chromium`. The model commands need Python 3; they do not need an internet connection.

## Putting it online

The site deploys to Vercel as a static site. `vercel.json` tells Vercel to run `npm run build`, serve `frontend/dist`, and send the security headers, so there is nothing to set up in the Vercel dashboard. Push to the connected Git repository, or run `npx vercel deploy`.

Any other static host works too: run `npm run build` and upload `frontend/dist`. Set the headers from `frontend/vite/securityHeaders.ts` on that host if you can.

## Writing code for this project

The code is TypeScript, written to be easy to read:

- Use `if` and `else` rather than the `? :` operator.
- Use `function () {}` rather than arrow functions.
- Start every file with a short comment saying what it is for.
- Keep each part of the page in its own folder under `frontend/src/features`.
- The page talks to the model only through `simulation/src/createTrafficSim.ts`, which checks every input.

`npm run lint` checks the first two rules, `npm run typecheck` checks the types, and `npm run format` handles the layout.

## Limits

This is a model for exploring ideas, not a traffic forecast or a safety assessment. The streets, car parks, traffic light locations and traffic counts are real. The SCATS counts do not say which way each car travels, so where trips go is the pattern that best reproduces the counts, not a survey of real journeys. Traffic light timings are not published, so each light shares its green time by demand, as SCATS does, on an assumed cycle. The simulated traffic matches the counts closely in total but not at every intersection; the page shows how closely. There are no trams, buses, bikes or pedestrians. Results from the web page and from desktop NetLogo may differ slightly because the two use different random number generators; compare runs within the same one.

## Credits

The traffic model builds on our groupmate's Hoddle Grid prototype, which credits Wilensky's NetLogo Traffic Grid (2003). The web page runs it with NetLogo Web (Tortoise) by Uri Wilensky and contributors, under the GPL (see `simulation/runtime/LICENSE.md` and https://github.com/NetLogo/Tortoise). Map data © OpenStreetMap contributors, available under the Open Database Licence: https://www.openstreetmap.org/copyright. Traffic signal locations and SCATS traffic volumes © Department of Transport and Planning, Victoria, under CC BY 4.0: https://opendata.transport.vic.gov.au/dataset/traffic-signal-volume-data.

## Real traffic data

The traffic comes from the SCATS counts for August 2026: every 15 minutes of an average weekday and an average weekend day, at the signalised intersections on the map. `npm run model:data` turns them into the model's traffic: it matches the DTP signal sites to the map, adds up each intersection's detectors, and then works out how many trips an hour go from each real entry point and car park to each part of the city, so that the model's own route choice reproduces the counts. See [how the data is used, and its limits](docs/data-and-limitations.md).

To rebuild everything after changing the map or the data, run `npm run model:map`, `npm run model:data`, `npm run model:desktop` and `npm run model:web`, in that order.
