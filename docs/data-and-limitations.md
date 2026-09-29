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

A baseline is a described condition, not simply a file called “baseline”. In this app, **Save baseline** saves a simulated run for scenario comparison. Observed profiles are a separate input. Applying a public-data profile does not turn that saved run into observed truth.

## Public data integrated in this version

The app offers flat synthetic demand or weekday/weekend time-of-day patterns derived from DTP SCATS detector activations within the map bounds. The period, cohort size, quality exclusions and checksums are in `simulation/netlogo/data/observed/summary.json`; the same metadata is shipped as `/sim/observed-data.json`. The app displays source and coverage information.

The profiles use one consistent detector cohort, requiring at least 80% valid days in each day group. Valid records contain 96 non-negative intervals, zero reported alarms, a positive daily total matching the interval sum, and no interval over 900 activations. Conflicting duplicates are rejected. A zero-total day is conservatively excluded; this can also exclude genuinely quiet days. Failed or missing observations are never silently treated as zeros. The full filtering recipe is in `simulation/build/prepare-observed.py`.

For each detector, average each 15-minute bin across valid days of that type. Average those results equally across detectors. Normalise weekday and weekend profiles by one shared peak value. Thus the data supplies **relative timing and weekday/weekend differences**, not a count of unique cars entering the CBD. The customer's “Cars arriving per hour” setting remains assumed and must be calibrated using appropriate boundary counts. Warm-up starts at the chosen start hour too; measurement begins after warm-up. Profiles repeat every 24 hours using a fixed day type; a long run does not automatically change from Friday to Saturday. August timestamps are AEST; profiles are not a daylight-saving conversion of a selected calendar date.

The signal inventory is matched conservatively to OSM graph nodes: intersection sites only, at least two matching street names and a separation no greater than 45 m. Mapped sites supplement inferred junctions; they do not replace timing plans. Pedestrian-only signal sites and uncertain matches are excluded. These are automated matches requiring review, not a survey-certified inventory.

This is a frozen August 2026 snapshot, not a live feed. Updating the period requires reviewing the processor’s version/date fields and revalidating the profiles. The published app loads only processed same-origin static files and operates locally in the browser; it does not send business scenarios to the data publisher. The raw monthly ZIP is excluded from Git. The retained CBD detector-day CSV can reproduce profiles without redownloading the statewide archive.

## Current simulator limitations

| Area         | What the simulator currently does                                                             | What is missing                                                                                                                      |
| ------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Demand       | Stochastic arrivals; optional observed relative time profile; twelve synthetic boundary gates | Measured absolute inbound demand and directional boundary weights; calibrated OD                                                     |
| Destinations | Through trips or six illustrative destinations on the real map                                | Real parking, loading, access demand and capacity                                                                                    |
| Signals      | Inferred junctions, optional matched inventory sites, generic two-phase timing                | Actual adaptive timings, movement-specific phases and pedestrian activation                                                          |
| Network      | Cached OSM geometry, ordinary one-way tags and available numeric lane/speed data              | Guaranteed current access/turn restrictions and all road details; only the retained connected graph is simulated                     |
| Driving      | Lane queues, acceleration/braking, turn logic and periodic route updates                      | Validated merging/lane changes, driver distributions, detailed intersection conflicts; movement advances at most one link per second |
| Closures     | Whole streets or graph sections, one direction or one lane; closures accumulate               | Work-zone tapers, controller operation and geometry-specific capacity; section IDs are not necessarily city blocks                   |
| Hook turns   | Optional schematic-grid heuristic                                                             | Verified location-specific hook-turn behaviour on the real map                                                                       |
| Other modes  | Cars only                                                                                     | Trams, buses, cyclists, pedestrians and accessible diversion routes                                                                  |
| Equipment    | No behavioural equipment model                                                                | Barriers/signs/VMS inventory and placement alone do not determine compliance or flow                                                 |
| Comparison   | Saved simulated baseline, paired seeded demand and results tables                             | Independent validation against field journey times, queues and directional counts                                                    |
| Measures     | Completed-trip averages, flow, active/queued/stranded counts and vehicle-hours                | Completed trips exclude unfinished journeys from their mean; total vehicle-hours includes entry waiting, not just driving            |
| Scope        | Exploratory scenario comparison                                                               | Validated forecasting, safety/compliance certification, emissions/economic claims                                                    |

The browser permits a saved baseline to survive settings changes and lists differences. The desktop clears incompatible baselines. Never interpret a difference as caused only by a closure when the demand, map, timing, warm-up or data profile also changed. Compare within the same runtime: NetLogo Desktop and NetLogo Web can use different random-number implementations.

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

Run `python3 simulation/build/prepare-observed.py --retained-only` from the repository root to rebuild from the retained CSV and quality audit. Then run `npm run model:desktop` and `npm run model:web`. The archived catalogue JSON files preserve the original downloadable resource URLs. To repeat the raw filtering, download that August volume resource as `simulation/netlogo/data/observed/scats-august-2026.zip` and run `npm run model:data`. Do not substitute another month without updating the version and reviewing coverage.

The filters excluded 65,617 of 105,560 CBD records in this snapshot; 39,943 passed before the shared-cohort selection. This substantial exclusion is a reason to treat the profile as a limited sample, not a representative census of all CBD traffic.
