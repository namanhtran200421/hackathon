# Validation

Tested with the installed NetLogo 7.0.4 runtime and bundled table extension, using CombinedTest.java.

Passed:
- Real OSM network loading: 724 nodes including gates/destinations; 1,292 directed links.
- 360-second real-map baseline and 360-second closure scenario; identical 252 generated arrivals with seed 42.
- Conservation: generated = completed + stranded + active + queued at gates.
- Baseline retention across Setup with the same controls, invalidation when map changes.
- Full named-street closure; reopening all restores both flags and lane capacity.
- One-lane reductions and reopening.
- Click handler follows real polylines and debounces held clicks.
- CSV export and headless view rendering.
- One-direction closures, a closure scheduled at 60 seconds, and hook-turn mode.
- Every active car belongs to exactly one road lane or hook-turn waiting area.
- 300 seconds on the schematic grid, including a section closure and reopening.

These checks validate model mechanics, not agreement with observed Melbourne traffic. Synthetic defaults are not calibrated.

Run from this folder on this Mac:

```sh
javac -cp '/Applications/NetLogo 7.0.4/app/netlogo-7.0.4.jar' CombinedTest.java
java -Djava.awt.headless=true -Dnetlogo.extensions.dir='/Applications/NetLogo 7.0.4/extensions' -cp '/Applications/NetLogo 7.0.4/app/*:.' CombinedTest "$PWD/Melbourne Traffic Combined.nlogox"
```

To rebuild the model after editing `combined.nls`, run `python3 build.py`.
To regenerate the merge from the original groupmate code and the merge scripts, run `python3 merge_code.py` first; this overwrites direct edits to `combined.nls`.
To refresh the compressed map from the parent's cached OSM extract, run `python3 prepare_map.py`.
