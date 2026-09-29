# Melbourne CBD traffic playground

## Run it

1. Open **Melbourne CBD Traffic.nlogox** in **NetLogo Desktop 7** (tested with 7.0.4).
2. Click **Setup**, then **Go / pause**. Keep the `data` folder beside the model.
3. Click **Choose a street** and select any named street, then click **Close street**. Repeat for multiple simultaneous closures. Choose a street and click **Reopen street** to reopen just that street.
4. Alternatively enable **Click to close** and click a road segment to toggle it. Unnamed roads can be edited this way. Turn off Click to close when finished editing.
5. **Selected street status** shows Open, Partly closed or Closed. **List closures** lists streets with closed segments.
6. **Reopen all** removes closures. **Setup** resets the scenario and all counters.

The included model has its code embedded: no Python, Java compilation, API key, GIS extension, or internet connection is needed to play. This version targets desktop NetLogo, not NetLogo Web, because it loads a local map file.

## Controls

- `initial-cars`: requested initial population; crowded origins can reduce the actual count. Press Setup after changing it.
- `arrivals-per-minute`: attempted synthetic trip arrivals. Blocked spawn positions are skipped.
- `signals?`: enables illustrative alternating traffic signals at branching nodes.
- `signal-seconds`: duration of each signal phase.
- `seed-value`: seed used on Setup; useful for repeatable experiments.
- `close-whole-street?`: closes every segment with the clicked street's name. With it off, a click closes the small geometry segment in both directions where present.

Grey lines are roads, coloured cars move on the left, and red lines are closed. North is up. The map uses a local metric projection (10 metres per world unit). One tick represents one second, though movement advances at most one geometry segment per tick, so short segments affect effective speed.

Monitors show active cars, completed journeys, the mean duration of completed journeys, stopped cars, and unroutable journeys. Unroutable counts include rejected new journeys and trips removed after a closure strands them. Completed-trip averages can be biased by unfinished/stranded trips: do not judge a closure using that average alone.

## What is real, and what is simulated?

**Real:** cached OpenStreetMap CBD street coordinates, street names, ordinary one-way tags, and numeric speed limits where present. Routing follows connected map nodes; nearby but unconnected streets are not joined artificially. The largest strongly connected motor-road component is retained so initial trip pairs are reachable.

**Simplified:** randomly sampled origins/destinations, traffic volume, vehicle following, inferred signals and two signal phases. Default speed is 40 km/h where a simple numeric speed tag is unavailable. Traffic routes minimise physical distance using A*, excluding closures. Vehicles reroute at the end of their current segment when the next segment is closed; vehicles already inside a new closure are allowed to exit it.

There are no real-time traffic feeds, calibrated demand, lane changing, realistic intersection conflict rules, hook turns, turning restrictions, conditional access restrictions, public transport, pedestrians or traffic equipment yet. Pedestrianised roads are excluded from the car graph. OSM access filtering is basic, and street-level restrictions must be checked before real planning. This is an educational sandbox, not a predictive traffic or safety assessment.

## Files and editing

- `Melbourne CBD Traffic.nlogox`: open this; includes the full editable code and interface.
- `traffic.nls`: readable copy of the model code. Editing this copy alone does not change the model until rebuilt. For quick experiments edit the Code tab in NetLogo and save there.
- `data/network.txt`: local map consumed by the simulation.
- `data/osm.xml`: cached public source extract.
- `data/summary.json`: graph counts and clipping bounds.
- `download_map.py`: optional refresh of public OSM extracts; needs Python 3, curl and internet. Downloads public geography only.
- `build_model.py`: rebuild the network and model from cached OSM and `traffic.nls`; currently uses the installed NetLogo 7.0.4 Traffic Basic file as an XML/interface-shape template. Rebuilding overwrites edits made in the NetLogo Code tab.
- `SmokeTest.java`: headless runtime check for baseline, closure and reopening.

## Map attribution

© [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available under the [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/1-0/). The derived road network retains that attribution and licence. Public map extract retrieved 29 September 2026 via the OpenStreetMap map API. Map freshness/completeness is not guaranteed.

NetLogo default shape definitions are taken from its bundled Traffic Basic model (Uri Wilensky / Northwestern University); see the installed model's Info tab for its licence. The simulation logic in this project was written for this playground.

Street selection is declared in `globals`; it no longer depends on an Interface chooser. If copying this code into an older model, remove any chooser whose variable is `selected-street` to avoid a duplicate declaration. Run `choose-street` in the Command Center if the older interface has no picker button.
