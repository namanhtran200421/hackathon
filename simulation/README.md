# The traffic model

This folder holds everything about the Melbourne traffic simulation: the NetLogo model, the map and traffic data, the team's original models, the tools that build the desktop and browser versions, and the TypeScript code that runs the model in the browser.

## Using it on the desktop

Open `netlogo/Melbourne Traffic Combined.nlogox` in NetLogo 7. Choose **day-type** and **start-time**, press **Setup**, then **Go / pause**.

To close a street, press **Choose street**, then **Apply closure**. You can also turn on **Click roads** and click a road on the map. Closed directions show in red and closed lanes in magenta. **Reopen selected** and **Reopen all** put the lanes back.

To compare with normal traffic, run with every road open until the warm-up has passed plus at least a minute, press **Save baseline**, then press **Setup**, close a street and run again. Switch **view-mode** to "change vs baseline" to see which roads gained or lost traffic. **Export CSV** writes `combined-link-results.csv` next to the model. The **SCATS match** monitor shows how many counted intersections are within GEH 5 of the counts.

The model's Info tab has the full details.

## How the model works

- One tick is one second, and one patch is 10 metres. The clock starts one warm-up before the start time, so counting starts at it.
- Cars enter where real roads cross the edge of the map (96 places, with their real lanes) and at 110 groups of public car parks. Each trip goes to one of 27 destination groups: the roads leaving the map, or the car parks, in each square of a 4 × 4 grid over the map. It ends at whichever place in that group it reaches first.
- How many trips go from each place to each group is estimated, hour by hour, from the SCATS counts (see below). Within the hour, trips rise and fall with the 15-minute counts.
- Each lane holds a queue of cars. Cars speed up, slow down and stop behind each other and at traffic lights.
- Traffic lights stand where DTP lists a signalised intersection; all the junctions of one intersection share a controller, and cars already inside it do not stop again. By default each intersection shares its green time between east–west and north–south by the cars waiting at the start of each cycle, as SCATS adapts to demand. Car park driveways give way.
- Some drivers use live traffic information and re-plan their route regularly. The rest use the normal travel times.
- Arrivals use their own random numbers, so a baseline run and a closure run with the same pattern number get exactly the same cars at the same times.

## What is real and what is estimated

Real, from OpenStreetMap: the street layout (including King St and Wurundjeri Way), one-way streets, the number of lanes and speed limits where the map records them, where roads cross the edge of the map, and public car parks.

Real, from DTP: where the traffic lights are, and the SCATS counts of traffic entering 64 intersections whose detectors cover every approach lane, for every 15 minutes of an average August 2026 weekday and weekend day.

Estimated from those counts: how many trips start at each entry point and car park and which part of the city they go to. The counts do not say which way cars travel, so this is the pattern that best reproduces them, not a survey of real journeys.

Assumed: traffic light cycle lengths and coordination, driver behaviour, and how many cars a road into the map or a car park driveway can send each hour. There are no trams, buses, bikes, pedestrians, turn bans or parking limits. Treat the results as a way to explore ideas, not as a forecast.

## What is in this folder

| Path                                        | What it is                                                                              |
| ------------------------------------------- | --------------------------------------------------------------------------------------- |
| `netlogo/Melbourne Traffic Combined.nlogox` | The model for desktop NetLogo                                                           |
| `netlogo/preview.png`                       | A picture of the desktop model                                                          |
| `netlogo/code/combined.nls`                 | The model's NetLogo code                                                                |
| `netlogo/code/closures.nls`                 | The road-closure controls, merged into the model                                        |
| `netlogo/code/osm_network.nls`              | The code that loads the real road map, merged into the model                            |
| `netlogo/code/real_traffic.nls`             | The real traffic, clock and SCATS comparison, merged into the model                     |
| `netlogo/data/osm.xml`                      | The raw OpenStreetMap extract of the CBD                                                |
| `netlogo/data/map.txt`                      | The road map the model loads, made from `osm.xml`                                       |
| `netlogo/data/observed/`                    | Victoria's traffic signal list and SCATS counts, and the model's traffic made from them |
| `netlogo/originals/`                        | The team's original models, kept unchanged                                              |
| `netlogo/tools/`                            | Scripts that build the desktop model and the road map, and a test                       |
| `src/`                                      | TypeScript: settings, data types, messages and the model controls                       |
| `runtime/`                                  | Files the browser loads from `/sim`                                                     |
| `build/`                                    | Turns the NetLogo model into JavaScript for the browser                                 |
| `test/`                                     | Tests of the model controls                                                             |

## Rebuilding

All scripts use Python 3 and need no internet connection. Run them from the project folder.

| Command                 | What it does                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------- |
| `npm run model:map`     | Rebuild `data/map.txt` from `data/osm.xml`                                                         |
| `npm run model:data`    | Rebuild the traffic in `data/observed/demand.txt` from the SCATS counts and the map                |
| `npm run model:desktop` | Recreate `netlogo/code/combined.nls` from the original Hoddle Grid model, then build the `.nlogox` |
| `npm run model:web`     | Rebuild the browser model in `runtime/` from the desktop model                                     |

Run them in that order after changing the map or the data.

`netlogo/tools/merge_code.py` recreates `netlogo/code/combined.nls` from the team's original Hoddle Grid model by applying our changes one by one. Along the way it takes out the original's made-up street grid, entry weights, car parks and hook turns, which the real data replaces. It overwrites `netlogo/code/combined.nls`, so make lasting code changes in the merge script (or in `closures.nls`, `osm_network.nls` and `real_traffic.nls`), not in `combined.nls` directly. To rebuild only the `.nlogox` from your edited code, run `python3 simulation/netlogo/tools/build.py`.

## The browser version

`build/prepare-model.py` makes a browser copy of the desktop model. It writes the road map and the traffic data straight into the code, because a browser cannot read files from disk, and switches off the desktop pop-up dialogs, file export and drawing, which the web page does itself. It also keeps a saved baseline when Setup is pressed, so the web page can reuse one baseline for many runs, and adds two small procedures to restore and clear it.

`build/compile-model.ts` turns that copy into JavaScript with the NetLogo Web compiler kept in `build/vendor/`. `npm run build` bundles `src/worker.ts` into `runtime/worker.js`. The browser loads these from `/sim`:

| File                 | What it is                                                   |
| -------------------- | ------------------------------------------------------------ |
| `tortoise-engine.js` | The NetLogo Web engine (third-party)                         |
| `model.js`           | The compiled model (generated)                               |
| `reporters.js`       | Read-only questions the page asks the model (generated)      |
| `worker.js`          | Runs the model on the browser's background thread (built)    |
| `network-osm.json`   | The road map, shown while the model loads (generated)        |
| `observed-data.json` | Where the traffic data came from and how it fits (generated) |

The TypeScript in `src/`:

| File                  | What it is                                                                |
| --------------------- | ------------------------------------------------------------------------- |
| `settings.ts`         | Every setting's name, starting value and limits; shared with the web page |
| `types.ts`            | The data the model hands to the page                                      |
| `packing.ts`          | How cars and road colours are packed into number arrays                   |
| `protocol.ts`         | The messages between the page and the worker                              |
| `createTrafficSim.ts` | The only way to control the model; it checks every input                  |
| `modelScope.ts`       | The parts of the NetLogo engine the controls use                          |
| `worker.ts`           | The background worker's run loop                                          |
| `loadInNode.ts`       | Runs the model in Node for the tests and the build                        |

Traffic movement, arrivals, traffic lights and route choice are the same code as the desktop model.

## How the real traffic is made

`build/prepare-observed.py` (`npm run model:data`) needs only Python 3 and the files in `netlogo/data`:

1. If the monthly SCATS ZIP is present, it filters it to the CBD sites and the quality checks, and rewrites `cbd-detector-days.csv` and `quality-audit.json`. Otherwise it uses the retained CSV.
2. It matches each DTP signalised intersection to the map junctions within 45 m that share at least two of its street names. All of them get traffic lights.
3. For every matched intersection whose detectors cover all its days well enough, it averages each detector's 15-minute counts and adds them up. It only compares the model with intersections that have at least one detector for every lane approaching them, because the others count only some approaches, usually the side street.
4. It routes trips from every entry point and car park to every destination group the way the model's drivers choose, eight times each to allow for their randomness, and notes which counted intersections each trip passes.
5. For each hour of a weekday and a weekend day, it scales the trips, first as a broad pattern and then pair by pair, until the routed traffic entering each counted intersection matches the counts as closely as possible (the multiplicative, or EM, update used for estimating trips from counts). No main road into the map sends more than 900 trips an hour per lane, no residential street more than 300 per lane, and no car park more than 300 per driveway lane.
6. It writes `demand.txt` for the model and `summary.json` (copied to `runtime/observed-data.json`) with the data's source, the method, and how well the estimate fits each quarter-hour.

The routes it uses follow the model's free-flow choices at its default settings. When the traffic runs, congestion, informed drivers and adaptive lights move it away from that estimate, which is why the model reports its own match with the counts.

## Testing

The browser version is tested automatically with `npm test`, which runs the same engine, model and controls the browser uses.

To test the desktop model with NetLogo 7.0.4 installed on a Mac:

```sh
cd simulation/netlogo/tools
javac -cp '/Applications/NetLogo 7.0.4/app/netlogo-7.0.4.jar' CombinedTest.java
java -Djava.awt.headless=true -Dnetlogo.extensions.dir='/Applications/NetLogo 7.0.4/extensions' -cp '/Applications/NetLogo 7.0.4/app/*:.' CombinedTest "$PWD/../Melbourne Traffic Combined.nlogox"
```

The desktop test checks that a baseline run and a closure run get the same arrivals with the same pattern number; every car is accounted for (arrived = finished + stranded + driving + waiting to enter); a baseline survives Setup when the settings match and is cleared when the day or time changes; whole-street, one-direction, lane and scheduled closures and reopening all work; clicking follows the real road shapes; the CSV export and the map view work without a screen; and every car is on exactly one lane.

These tests check that the model works as designed. How well it matches real Melbourne traffic is shown by the model itself, against the SCATS counts.

## Credits

The Hoddle Grid traffic prototype was written by our groupmate; its Info tab credits Wilensky (2003), NetLogo Traffic Grid. Map data © OpenStreetMap contributors, https://www.openstreetmap.org/copyright, under the Open Database Licence. The map extract was downloaded on 29 September 2026.

## Real traffic data

See [how the data is used, and its limits](../docs/data-and-limitations.md). Traffic signal locations and SCATS volumes © Department of Transport and Planning, Victoria, CC BY 4.0.
