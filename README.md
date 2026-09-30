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

The road map is ready when the page loads. Press **Start** to set the traffic moving. The **Quick guide** button at the top of the page explains everything else in seven short steps. The **Report** page, linked at the top, holds the full results and the works planner.

## What you can do

- **Change the traffic.** Set how many cars arrive each hour, how many are just passing through, and how many drivers use live traffic information to avoid jams.
- **Close streets.** Pick a street and close it in both directions, in one direction, or by one lane. You can also click roads on the map to close and reopen them. Closures work while the traffic is moving.
- **Watch it live.** The map shows every car. Colour the roads by traffic jams, by traffic volume, or by the change from normal traffic. Zoom in with the + button, or hold Ctrl and scroll.
- **Run as long as you like.** The simulation normally stops after its counting time. Turn on **Keep running** to let it go until you press Pause.
- **Compare with normal traffic.** Record a baseline once, with every road open. Every later run is compared with it on the Report page: a summary table, charts over time, and the streets that changed most. The baseline is kept in your browser, so it survives a reload.
- **Plan road works.** On the Report page, describe the works and your limits, and the planner recommends when to close the road and over how many shifts. See [Planning road works](#planning-road-works) below.
- **Download the numbers.** Download CSV saves the traffic on every road in the same format as the desktop model.

Every button, slider and switch from the desktop NetLogo model has a matching control on the page.

## How it works

There is no backend. The whole traffic model runs in your browser, so the site is a React page plus a set of static files, and any static host can serve it.

The project has two parts, both written in TypeScript:

1. **The simulation** (`simulation/`). The NetLogo model, the map data and the tools that build it, plus the code that runs the model in the browser. The page runs the same model as desktop NetLogo, using NetLogo Web (the engine behind netlogoweb.org).
2. **The front end** (`frontend/`). A React page built with Vite. The model runs in a background worker inside the browser, so the page stays smooth. The map is drawn on a canvas that refreshes 60 times a second and slides each car between its positions.

## Planning road works

The Report page answers the question councils and contractors start with: when should we close this road so that traffic suffers least, and where will the traffic go?

The simulator and the planner work as one flow:

1. **Try a closure in the simulator.** Close a street, run it against your baseline and watch the detours happen.
2. **Press "Find the best time for this closure".** The button sits under Road closures and under the map. It opens the Report page with the planner's form filled in: the street closed on the map, closed the same way, using the simulator's settings (road map, cars per hour, drivers, traffic lights).
3. **Read what you saw.** The top of the Report page sums up your run: what was closed, how it compared with the baseline, and the streets that got busier. These are the same numbers as the CSV download. One run is one traffic level and one traffic pattern, so it shows _where_ the traffic goes but not _when_ to close the road.
4. **Find the best plan.** The planner tests the same closure at every time of day (below), then says when to close the road, over how many shifts, and where the detour traffic goes at that time.
5. **Watch it in the simulator.** This sets the recommended plan up on the map, so you can see it and show others.

The report says which simulator settings it used. If you change them afterwards, it warns that the plan is out of date until you search again.

You describe the works: the street and which part, how it is closed, how many hours of work are needed, the longest shift the crew can work, and how long setting up and packing away takes. You can limit the works to nights or daytime, and to weekdays or weekends, and say what matters most: least disruption, a balance, or the fewest shifts.

The planner then works in three stages, all in background workers in your browser:

1. **Test the works at four traffic levels**, from quiet (15% of the busiest time) to the busiest time. Each test runs the city twice with exactly the same cars, once with the works and once with every road open, so the difference is caused by the works alone. Every test is repeated with different random traffic (3 times for a quick check, 8 for a thorough one). This repetition is a Monte Carlo simulation, and it is where the ranges in the report come from.
2. **Rank every plan the limits allow.** How busy each quarter hour of the day is comes from the public traffic signal counts (see [Observed traffic data](#observed-traffic-data)), separately for weekdays and weekends, so each quarter hour's extra delay can be read off the tested levels. Every start hour, kind of day and number of shifts is added up and ranked. Setting-up time counts as closed time, so many tiny shifts are not free.
3. **Double-check the best plans** by re-testing their busiest hour directly, with that hour's real traffic pattern.

The report gives the recommended plan in one sentence, the likely extra time in traffic (in car-hours, with the range across repeats), what it saves compared with a daytime closure, a 24-hour chart of the best and worst times, where the traffic goes (which streets take the detour traffic at the plan's busiest hour, from the double-check tests), other good options, what could go wrong (running late, queues at the edge of the city, trips that cannot get through, close calls) and how the numbers were worked out. **Watch it in the simulator** sets the plan up on the map, and the report prints or saves as a PDF.

Test results are remembered in your browser, so repeating a search or changing only the limits or priority is instant. A quick check takes about a minute on a typical laptop.

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
    planner/                    the works planner on the Report page
    log/                        the simulation log
    guide/                      the quick guide
  src/lib/                    Number and time formatting
  src/styles/                 Colours and layout, one file per part
  vite/                       Build helpers: the /sim files and security headers
  test/                       Front-end tests
simulation/                 Everything about the traffic model
  src/                        Settings, data types, messages, and the code
                              that controls the model in the browser and Node,
                              including the planner's background test runs
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

This is a model for exploring ideas, not a traffic forecast or a safety assessment. The streets are real. Optional SCATS profiles provide observed time-of-day patterns, while absolute arrival rates, destinations and traffic light timings remain assumed. There are no trams, buses, bikes or pedestrians. Results from the web page and from desktop NetLogo may differ slightly because the two use different random number generators; compare runs within the same one.

## Credits

The traffic model builds on our groupmate's Hoddle Grid prototype, which credits Wilensky's NetLogo Traffic Grid (2003). The web page runs it with NetLogo Web (Tortoise) by Uri Wilensky and contributors, under the GPL (see `simulation/runtime/LICENSE.md` and https://github.com/NetLogo/Tortoise). Map data © OpenStreetMap contributors, available under the Open Database Licence: https://www.openstreetmap.org/copyright.

## Observed traffic data

Select **SCATS weekday** or **SCATS weekend** and restart to use August 2026 Melbourne CBD detector patterns. The arrival slider sets an assumed peak, not a measured boundary flow. Matched DTP signal locations are optional; timings remain synthetic. See [data requirements, provenance and model limitations](docs/data-and-limitations.md). Rebuild retained data with `npm run model:data`, then `npm run model:desktop` and `npm run model:web`.
