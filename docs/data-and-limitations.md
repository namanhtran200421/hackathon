# Data needed for a credible traffic simulation

This document describes what a customer should supply, how public data can help, and what Melbourne Traffic Lab can and cannot currently claim. It applies to the browser app and desktop NetLogo model. Updated 30 September 2026.

## What a useful model must demonstrate

A model should reproduce the observed conditions relevant to the decision before being used to compare interventions. A real street map and an attractive animation do not demonstrate accuracy. Agree the study area, road users, time periods, performance measures and acceptance criteria with the customer before collecting data. Include likely detours and upstream queues, not just the work site.

Use data from consistent dates and time periods. Tune the model against a calibration sample, then evaluate it against separate observations. Run multiple random seeds and present uncertainty, sensitivity to missing inputs and unfinished journeys. No single error threshold or survey duration is suitable for every project.

## Customer data checklist

| Priority                     | Data to gather                             | Required detail and reason                                                                                                                                                                                                                        |
| ---------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Essential                    | Study area and operating period            | Work location, surrounding intersections, detours, survey dates, weekday/weekend, school term, weather, events and incidents. Include traffic building up and clearing.                                                                           |
| Essential                    | Boundary and intersection counts           | Timestamped directional entry/exit and turning counts, preferably 15-minute bins; vehicle classifications including heavy vehicles. Count compatible movements at the same time. Do not sum every internal detector into entry demand.            |
| Essential                    | Road geometry and legal movements          | Lanes by direction, turn bays/storage lengths, lane widths, one-way operation, turn bans, hook turns, speed limits, access restrictions, kerbside parking/loading and driveways. Site-check the map.                                              |
| Essential                    | Signal operation                           | Correct detector-to-movement mapping, phase sequence, green/amber/all-red, pedestrian phases, coordination and the plans operating during the survey. Published operation sheets do not establish every realised adaptive timing.                 |
| Essential                    | Independent performance observations       | Repeated journey times, typical and long queues, queue spillback and discharge rates at bottlenecks. Keep a separate date/period for validation.                                                                                                  |
| Essential                    | Proposed work-zone plan                    | Lane/footpath closures, extent, dates/hours, staging, temporary speeds, turning changes, access needs, barrier/taper locations, signs and VMS messages, temporary crossings and traffic-controller operation.                                     |
| Needed for multimodal claims | Pedestrians, cyclists and public transport | Crossing and footpath flows, accessibility/diversions, bus/tram routes, headways, stop locations, dwell times, capacity and priority rules. The engine must explicitly represent these modes before these observations can support impact claims. |
| Useful refinement            | Route choice and origins/destinations      | Turning proportions, surveys or appropriately licensed/privacy-preserving OD evidence, through/local split, parking destinations and capacity. Aggregate detector counts cannot identify complete journeys.                                       |
| Useful refinement            | Behaviour in comparable work zones         | Merge/discharge rates, compliance with diversion signs, speed distribution and observed route changes. Equipment inventory alone cannot predict those effects.                                                                                    |

A proportionate pilot could study one work zone, collect concurrent counts/queues/journey times over several representative periods, and reserve a separate period for validation. This is a suggested pilot design, not an authority's mandated survey duration. Store only data needed for the task; aggregate counts generally do not require number plates or identifiable video in the app.

## Data provenance and quality requirements

Every imported dataset should record its publisher, source/download URL, licence, extraction date, coverage, units, timezone, version and quality filters. Retain a reproducible subset or checksum. Distinguish missing records from measured zero counts; check sensor health, duplicate records, timestamp alignment and daylight saving. Record relocated sensors and changes to road layout. Separate vehicle counts, detector activations, pedestrians and passenger counts.

A baseline is a described condition, not simply a file called “baseline”. In this app, **Save baseline** saves a simulated run for scenario comparison. The SCATS counts are a separate input. Running the model on them does not turn a saved run into observed truth.

## Public data integrated in this version

The model runs only on real data where public data exists. The user chooses a weekday or weekend day and a start time; everything below follows from that. The period, sites, quality exclusions, method, fit and checksums are in `simulation/netlogo/data/observed/summary.json`, shipped as `/sim/observed-data.json`.

**Road network (OpenStreetMap).** Streets, one-way rules and available lane and speed tags inside the map window, including trunk roads (King St and Wurundjeri Way). Where a road crosses the window's edge, the model has an entry and/or exit point with that road's lanes in each direction (96 places). Public off-street car parks and car park entrances are attached to their nearest ordinary junction (110 groups).

**Traffic signals (DTP signal inventory).** Intersection sites are matched to map junctions within 45 m that share at least two street names; 107 of the 119 intersection sites in the window match, at 317 junctions, because OpenStreetMap often draws one intersection as several junctions. Only these junctions have signals; all the junctions of one site share one controller, and cars already inside the intersection do not stop again. Pedestrian-operated and flashing crossings are not modelled. These are automated matches requiring review, not a survey-certified inventory.

**Counts (DTP SCATS volumes).** Valid detector-days contain 96 non-negative intervals, zero reported alarms, a positive daily total matching the interval sum, and no interval over 900 activations; conflicting duplicates are rejected, and failed or missing observations are never treated as zeros (the full recipe is in `simulation/build/prepare-observed.py`). A matched site's count is the sum of its detectors, each averaged over its valid days of that type, in vehicles per hour for each 15 minutes. A site is used only when every detector seen there has valid data on at least half the days of each type, and only when it has at least one detector for every lane approaching it in the map: many minor intersections have detectors on only some approaches (King St and Little Collins St, for example, has one detector for eight lanes). 64 intersections pass. The data supplies intersection totals, not directions, turns or journeys.

**Trips (estimated from the counts).** Trips start at the entry points and car parks and end at the nearest place in one of 27 destination groups (the edge crossings, or the car parks, in each square of a 4 × 4 grid over the map). Each trip is routed eight times with the model's own route choice at its default settings, and the counted intersections it enters are noted. For each hour of each day type, the multiplicative (expectation-maximisation) update for counts scales the trips, first as a pattern (trips starting at each place, pull of each group) and then pair by pair, until routed traffic entering each counted intersection best matches the counts. No main road crossing the edge may send more than 900 trips an hour per lane, no residential street more than 300 per lane, and no car park more than 300 per driveway lane; these capacities are assumptions. Within the hour, trips follow the 15-minute count totals. The result reproduces the counts well in this static routing (46 to 62 of the 64 intersections within GEH 5, depending on the quarter-hour; 52 at the median), but it is one of many trip patterns that could do so, not a measured origin–destination survey.

**Traffic lights.** Timings are not in this data. By default each intersection splits its green time between east–west and north–south by the cars on its approaches at the start of each cycle (never less than a fifth each way), as SCATS adapts to demand. The cycle length (80 s) and coordination remain assumed.

**How close the running model gets.** The model reports, for the counting time, the simulated traffic entering each counted intersection beside the counts for the same stretch of the day, and the share within GEH 5. Congestion, informed drivers rerouting, the adaptive lights and capacity limits move the running traffic away from the static estimate. Spot checks with the default settings (10-minute warm-up, 10 minutes counted, pattern number 42):

| Start             | Counted intersections within GEH 5 | Counted traffic the simulation carried |
| ----------------- | ---------------------------------- | -------------------------------------- |
| Weekend, 10:00 am | 42 of 64                           | 93%                                    |
| Weekday, 10:00 pm | 37 of 64                           | 93%                                    |
| Weekend, 1:00 pm  | 26 of 64                           | 87%                                    |
| Weekday, 8:00 am  | 21 to 31 of 64                     | 87% to 92%                             |
| Weekday, 5:00 pm  | 11 of 64                           | 75%                                    |

The share within GEH 5 moves by a few intersections from minute to minute. Outside the peaks the simulation reproduces the counts reasonably well. In the weekday peaks, and especially the evening peak, the simulated network jams more than the real one: queues build at Wurundjeri Way, along King St and around Victoria Parade, cars wait to enter the map, and the busiest arterials (Victoria St, Russell and Flinders St, King and Collins St) carry less than their counts. Closure comparisons at those times show how the model's jams respond, which may overstate real delays.

Trips repeat every 24 hours using a fixed day type; a long run does not change from Friday to Saturday. August timestamps are AEST. This is a frozen August 2026 snapshot, not a live feed. Updating the period requires reviewing the processor's version/date fields and revalidating the fit. The published app loads only processed same-origin static files and operates locally in the browser; it does not send business scenarios to the data publisher. The raw monthly ZIP is excluded from Git; the retained CBD detector-day CSV reproduces everything without redownloading the statewide archive.

## Current simulator limitations

| Area         | What the simulator currently does                                                                                                         | What is missing                                                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Demand       | Stochastic arrivals at real edge crossings and car parks, estimated from SCATS intersection counts for each hour                          | Directional boundary counts; measured origin–destination patterns; trips to on-street parking and loading                            |
| Destinations | 27 groups of real edge crossings and OpenStreetMap public car parks                                                                       | Real parking capacity, occupancy and access; on-street parking and loading                                                           |
| Signals      | DTP signal sites only, one controller per site, two phases sharing green time by demand                                                   | Actual SCATS timings, movement-specific phases, coordination and pedestrian activation                                               |
| Network      | Cached OSM geometry, ordinary one-way tags and available numeric lane/speed data                                                          | Guaranteed current access/turn restrictions and all road details; only the retained connected graph is simulated                     |
| Driving      | Lane queues, acceleration/braking, turn logic and periodic route updates                                                                  | Validated merging/lane changes, driver distributions, detailed intersection conflicts; movement advances at most one link per second |
| Closures     | Whole streets or graph sections, one direction or one lane; closures accumulate                                                           | Work-zone tapers, controller operation and geometry-specific capacity; section IDs are not necessarily city blocks                   |
| Hook turns   | Not modelled: there is no data on where hook turns apply                                                                                  | Verified location-specific hook-turn behaviour on the real map                                                                       |
| Other modes  | Cars only                                                                                                                                 | Trams, buses, cyclists, pedestrians and accessible diversion routes                                                                  |
| Equipment    | No behavioural equipment model                                                                                                            | Barriers/signs/VMS inventory and placement alone do not determine compliance or flow                                                 |
| Comparison   | Saved simulated baseline, paired seeded demand, results tables, and the model's own GEH comparison with the SCATS counts it was fitted to | Independent validation against a separate period, field journey times, queues and directional counts                                 |
| Measures     | Completed-trip averages, flow, active/queued/stranded counts and vehicle-hours                                                            | Completed trips exclude unfinished journeys from their mean; total vehicle-hours includes entry waiting, not just driving            |
| Scope        | Exploratory scenario comparison                                                                                                           | Validated forecasting, safety/compliance certification, emissions/economic claims                                                    |

The browser permits a saved baseline to survive settings changes and lists differences. The desktop clears incompatible baselines. Never interpret a difference as caused only by a closure when the demand, map, timing, warm-up or data profile also changed. Even with identical arrivals, drivers make different random route choices once anything changes, so some difference is chance: at weekday 8 am with 10 minutes counted, closing an almost unused laneway moved the typical street by about 13 cars an hour and three streets by over 100, and changed trips finished by under 1%; closing Collins St moved the typical street by about 16 and thirteen streets by over 100, sent 20 to 90 more cars an hour along its parallel streets, cut trips finished by 4% and added 5% to the hours spent driving. Count for longer, or repeat with other pattern numbers, before relying on small changes. Compare within the same runtime: NetLogo Desktop and NetLogo Web can use different random-number implementations.

## Before making customer-facing prediction claims

1. Confirm that the road users and interventions being studied are actually represented.
2. Verify geometry and detector/movement mapping with local evidence.
3. Calibrate demand, routes and signal operation to concurrent observations.
4. Validate on separate periods with agreed measures: directional counts, travel-time distributions, queues/spillback and throughput. Report error and coverage, including failures.
5. Run matched baseline/intervention seeds and sensitivity tests for uncertain inputs.
6. Report active, waiting, completed and stranded journeys together; retain assumptions and model/data versions with every result.
7. Obtain suitable transport-modelling review for decisions requiring professional assurance.

## Sources

- [Victorian Simulation Modelling Guidelines](https://www.vicroads.vic.gov.au/-/media/files/technical-documents-new/miscellaneous-guidelines/transport-modelling-guidelines-volume-4-simulation-modelling.ashx).
- [FHWA Traffic Analysis Toolbox, Volume III (2019)](https://ops.fhwa.dot.gov/publications/fhwahop18036/).
- [DTP Traffic Signal Volume Data](https://opendata.transport.vic.gov.au/dataset/traffic-signal-volume-data), CC BY 4.0.
- [DTP Victorian Traffic Signals](https://opendata.transport.vic.gov.au/dataset/victorian-traffic-signals), CC BY 4.0.
- [DTP Signal Configuration Sheets](https://opendata.transport.vic.gov.au/dataset/traffic-signal-configuration-data-sheets): identified for future movement/timing validation; not ingested here.
- [City of Melbourne Transport Activity Counts](https://data.melbourne.vic.gov.au/explore/dataset/transport-activity-counts/table/): candidate additional source; its API endpoint was unavailable during this integration and its counts are not used.
- [OpenStreetMap attribution and licence](https://www.openstreetmap.org/copyright).

## Reproduce this snapshot

Run `python3 simulation/build/prepare-observed.py --retained-only` from the repository root to rebuild from the retained CSV and quality audit (it reads the map from `simulation/netlogo/data/map.txt`, so run `npm run model:map` first if the map changed). Then run `npm run model:desktop` and `npm run model:web`. The archived catalogue JSON files preserve the original downloadable resource URLs. To repeat the raw filtering, download that August volume resource as `simulation/netlogo/data/observed/scats-august-2026.zip` and run `npm run model:data`. Do not substitute another month without updating the version and reviewing coverage.

The filters excluded 65,617 of 105,560 CBD records in this snapshot; 39,943 passed. This substantial exclusion is a reason to treat the counts as a limited sample, not a representative census of all CBD traffic. Because the model's trips are fitted to the same counts it is compared with, the GEH comparison shows how well the model reproduces them, not an independent validation.
