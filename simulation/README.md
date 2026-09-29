# The traffic model

This folder holds everything about the Melbourne traffic simulation: the NetLogo model, the map data, the team's original models, the tools that build the desktop and browser versions, and the TypeScript code that runs the model in the browser.

## Using it on the desktop

Open `netlogo/Melbourne Traffic Combined.nlogox` in NetLogo 7. Press **Setup**, then **Go / pause**.

To close a street, press **Choose street**, then **Apply closure**. You can also turn on **Click roads** and click a road on the map. Closed directions show in red and closed lanes in magenta. **Reopen selected** and **Reopen all** put the lanes back.

To use the simple street grid instead of the real map, change **network-source** and press **Setup**.

To compare with normal traffic, run with every road open until the warm-up has passed plus at least a minute, press **Save baseline**, then press **Setup**, close a street and run again. Switch **view-mode** to "change vs baseline" to see which roads gained or lost traffic. **Export CSV** writes `combined-link-results.csv` next to the model.

The model's Info tab has the full details.

## How the model works

- One tick is one second, and one patch is 10 metres.
- On the real map, cars arrive at twelve entry points around the edge of the city and drive to one of those or to one of six made-up destinations inside it.
- Each lane holds a queue of cars. Cars speed up, slow down and stop behind each other and at traffic lights.
- Traffic lights are placed at junctions where main streets meet. Their timings are made up.
- Some drivers use live traffic information and re-plan their route regularly. The rest use the normal travel times.
- Arrivals use their own random numbers, so a baseline run and a closure run with the same pattern number get exactly the same cars at the same times.

## What is real and what is made up

Real, from OpenStreetMap: the street layout, one-way streets, and the number of lanes and speed limits where the map records them.

Observed when selected: relative weekday/weekend demand profiles and conservatively matched signal locations from DTP. Assumed: absolute arrival rates, where cars go, traffic light timings, and destinations. There are no trams, buses, bikes, pedestrians, turn bans or parking limits. Treat the results as a way to explore ideas, not as a forecast.

## What is in this folder

| Path                                        | What it is                                                        |
| ------------------------------------------- | ----------------------------------------------------------------- |
| `netlogo/Melbourne Traffic Combined.nlogox` | The model for desktop NetLogo                                     |
| `netlogo/preview.png`                       | A picture of the desktop model                                    |
| `netlogo/code/combined.nls`                 | The model's NetLogo code                                          |
| `netlogo/code/closures.nls`                 | The road-closure controls, merged into the model                  |
| `netlogo/code/osm_network.nls`              | The code that loads the real road map, merged into the model      |
| `netlogo/data/osm.xml`                      | The raw OpenStreetMap extract of the CBD                          |
| `netlogo/data/map.txt`                      | The road map the model loads, made from `osm.xml`                 |
| `netlogo/data/observed/`                    | Traffic signal and SCATS site lists from Victoria's open data     |
| `netlogo/originals/`                        | The team's original models, kept unchanged                        |
| `netlogo/tools/`                            | Scripts that build the desktop model and the road map, and a test |
| `src/`                                      | TypeScript: settings, data types, messages and the model controls |
| `runtime/`                                  | Files the browser loads from `/sim`                               |
| `build/`                                    | Turns the NetLogo model into JavaScript for the browser           |
| `test/`                                     | Tests of the model controls                                       |

## Rebuilding

All scripts use Python 3 and need no internet connection. Run them from the project folder.

| Command                 | What it does                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------- |
| `npm run model:map`     | Rebuild `data/map.txt` from `data/osm.xml`                                                         |
| `npm run model:desktop` | Recreate `netlogo/code/combined.nls` from the original Hoddle Grid model, then build the `.nlogox` |
| `npm run model:web`     | Rebuild the browser model in `runtime/` from the desktop model                                     |

`netlogo/tools/merge_code.py` recreates `netlogo/code/combined.nls` from the team's original Hoddle Grid model by applying our changes one by one. It overwrites `netlogo/code/combined.nls`, so make lasting code changes in the merge script (or in `closures.nls` and `osm_network.nls`), not in `combined.nls` directly. To rebuild only the `.nlogox` from your edited code, run `python3 simulation/netlogo/tools/build.py`.

## The browser version

`build/prepare-model.py` makes a browser copy of the desktop model. It writes the road map straight into the code, because a browser cannot read files from disk, and switches off the desktop pop-up dialogs, file export and drawing, which the web page does itself. It also keeps a saved baseline when Setup is pressed, so the web page can reuse one baseline for many runs, and adds two small procedures to restore and clear it.

`build/compile-model.ts` turns that copy into JavaScript with the NetLogo Web compiler kept in `build/vendor/`. `npm run build` bundles `src/worker.ts` into `runtime/worker.js`. The browser loads these from `/sim`:

| File                 | What it is                                                 |
| -------------------- | ---------------------------------------------------------- |
| `tortoise-engine.js` | The NetLogo Web engine (third-party)                       |
| `model.js`           | The compiled model (generated)                             |
| `reporters.js`       | Read-only questions the page asks the model (generated)    |
| `worker.js`          | Runs the model on the browser's background thread (built)  |
| `network-*.json`     | The two road maps, shown while the model loads (generated) |

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

## Testing

The browser version is tested automatically with `npm test`, which runs the same engine, model and controls the browser uses.

To test the desktop model with NetLogo 7.0.4 installed on a Mac:

```sh
cd simulation/netlogo/tools
javac -cp '/Applications/NetLogo 7.0.4/app/netlogo-7.0.4.jar' CombinedTest.java
java -Djava.awt.headless=true -Dnetlogo.extensions.dir='/Applications/NetLogo 7.0.4/extensions' -cp '/Applications/NetLogo 7.0.4/app/*:.' CombinedTest "$PWD/../Melbourne Traffic Combined.nlogox"
```

These checks passed on the desktop model:

- The real map loads with 724 junctions (including entry points and destinations) and 1,292 one-way road links.
- A 360-second run with every road open and a 360-second closure run get the same 252 arrivals with pattern number 42.
- Every car is accounted for: arrived = finished + stranded + driving + waiting to enter.
- A baseline survives Setup when the settings match and is cleared when the map changes.
- Whole-street closures, one-direction closures, lane closures, closures scheduled for later, and reopening all work.
- Clicking follows the real road shapes.
- The CSV export and the map view work without a screen.
- Every car is on exactly one lane.
- A 300-second run on the simple grid with a section closure and reopening works.

These tests check that the model works as designed, not that it matches real Melbourne traffic.

## Credits

The Hoddle Grid traffic prototype was written by our groupmate; its Info tab credits Wilensky (2003), NetLogo Traffic Grid. Map data © OpenStreetMap contributors, https://www.openstreetmap.org/copyright, under the Open Database Licence. The map extract was downloaded on 29 September 2026.

## Observed traffic data

Select **SCATS weekday** or **SCATS weekend** and restart to use August 2026 Melbourne CBD detector patterns. The arrival slider sets an assumed peak, not a measured boundary flow. Matched DTP signal locations are optional; timings remain synthetic. See [data requirements, provenance and model limitations](../docs/data-and-limitations.md). Rebuild retained data with `npm run model:data`, then `npm run model:desktop` and `npm run model:web`.
