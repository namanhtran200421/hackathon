# Traffic workbench behavior

Business evidence: combined/README.md and combined/combined.nls. The browser runs the compiled NetLogo model with unchanged traffic and routing rules. Desktop dialogs, file I/O and drawing are replaced by web controls. Web and desktop random streams may differ; compare scenarios within the same runtime and seed.

| Capability     | Canonical owner                 | Source of truth      | Allowed variants        | Verification               |
| -------------- | ------------------------------- | -------------------- | ----------------------- | -------------------------- |
| Select/Listbox | native select via Fields/Choice | DESIGN.md            | native                  | browser keyboard and popup |
| Form           | TrafficLab, controls.mjs        | sim-core.js SETTINGS | slider, switch, chooser | unit validation tests      |
| Scrollbar      | globals.css                     | DESIGN.md tokens     | global                  | computed style             |
| Toast          | TrafficLab status region        | this contract        | status/error            | browser lifecycle checks   |
| Dialog         | QuickGuide native dialog        | this contract        | side sheet              | browser Escape and focus   |

Every desktop widget has one web control with the desktop range, step and default. Changing a control sets the model global immediately, as in NetLogo. Controls the model reads only in Setup carry a Setup tag, and the Setup button shows a dot until Setup runs.

Go runs the model continuously and Pause stops it; Step 1 s pauses and advances one tick. Simulation speed sets simulated seconds per real second; Max runs as fast as the engine allows. With Run forever off, the model stops itself at the end of the measurement window, like the desktop forever button, and the status says so. With Run forever on, the measurement window is open-ended until the user pauses.

The map animates actual model ticks only; it never fabricates traffic. Cars are interpolated between consecutive ticks. Reduced motion shows each tick without interpolation. Reading the model for display never changes the model's random stream.

Closures apply live, through the model's own procedures. Map clicks select a street; with Click roads on, a click toggles the highlighted road through the model's pointer handler. The native Street and Extent lists offer the same selection by keyboard. Closed roads are dashed, reduced lanes use a separate colour, and closed streets are listed in text with a Reopen action.

Save baseline uses the model's guards: all roads open and at least one minute measured. Refusals appear in the status region. The baseline is saved once and reused for every later run, across Setup, settings changes and reloads, until the user replaces or clears it. Every setting that differs from the baseline is listed next to the comparison. Report time means only for completed measurement-window trips. Show completed, waiting, stranded and active counts. The baseline is stored in this browser only; it is never shared.

Run results are computed from a frozen copy taken when the model pauses or stops, so they never shift while the traffic runs. Baseline and closure runs are compared at the same simulated time, the end of the shorter run. Charts carry a legend, a crosshair or per-bar tooltip, and the same values appear in tables. Series colours pass the palette validator; text never uses a series colour.

CSV export uses the desktop column layout and the model's own rates. All errors have recovery text. If the engine fails to load, the page offers Reload engine. Status updates never move focus. Locale en-AU; numbers use Intl formatting and times are simulated elapsed time. Responsive at 390px with no horizontal page scroll; all controls have visible keyboard focus.
