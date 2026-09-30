# Design

How the Melbourne Traffic Lab page looks and behaves.

## The idea

A practical tool with one job: pick a real day and time, run the NetLogo model on the real traffic for it, and compare a road closure with normal traffic. It borrows the look of Australian traffic-management equipment: safety yellow, black and light grey, square corners and bold, tightly spaced headings. We use our own name and mark and borrow only the visual style, never another company's brand.

Written for everyday users in Australian English. Words like "vehicles per hour" become "cars per hour"; "Setup" becomes "Restart". The Quick guide maps every NetLogo control name to its label on the page.

## Colours

The colour tokens live in `frontend/src/styles/tokens.css`; map colours are at the top of `frontend/src/styles/base.css`. Each part of the page has its own stylesheet in the same folder.

- **Safety yellow** (`#fed203`): the header, main buttons (Start, Close this street), the figure tiles and the chosen street on the map. Never put white text on yellow.
- **Black**: text, the top bar, the map's toolbar and run bar, the simulation log and the footer.
- **Light grey** page background, **white** panels.
- **On the map**: roads into the map are grey squares at the edge; car parks are small black squares marked P. Moving cars black, slow cars amber, stopped cars red. Jams run from grey through yellow and orange to dark red. Volume runs from grey to black. Change from baseline is orange for more traffic and blue for less. Plum marks a closed lane. Red dashes mark closed roads.
- **Charts**: violet for this run and green for the baseline; orange and blue for more and less traffic. These passed a colour-blindness check. Text never uses a chart colour.
- Red is only for closures, stopped cars and errors. Status colours always come with an icon and a word.

## Type

Open Sans (bundled with the page, 600 to 800 weight) for headings, navigation, tile figures and group titles, with tight letter spacing. Navigation and group titles are in capitals. Arial for labels and text. Monospace for the clock, coordinates and the simulation log. Numbers in tables line up.

## Layout

From top to bottom: a thin black bar, the yellow header with a black pentagon name plate, a grey introduction band, then the simulator. Settings sit on the left (Day and time, Scenario, Road closures, Real traffic data, then fold-out groups for traffic lights, route choice and counting); the map sits on the right with a black toolbar above it and a black run bar below it (Restart, Start / Pause, Step 1 second, speed, Keep running, clock). Under the map come the yellow figure tiles, "Compare with normal traffic", the simulation log, the status line and the run results. A black footer ends the page.

Below 900 px wide, the map comes first and the settings follow. Below 430 px, the run buttons share one row and figures use two columns. The page never scrolls sideways.

## Controls

- Main buttons are yellow with black text. Other buttons are white with a black border and turn black on hover; on black bars they are outlined in white.
- Every control has a visible label and a 3 px focus outline (black on light backgrounds, yellow on dark ones). Buttons are at least 44 px tall.
- Switches are real checkboxes with the switch role. Drop-down lists are the browser's own.
- Settings that only apply after a restart carry a small yellow "Restart" tag, and the Restart button shows a dot until you press it.
- There are no pop-up alerts. The Quick guide is a side panel that closes with Escape.

## Behaviour

- Every desktop NetLogo control has one control on the page, with the same range, step and starting value. Changing a control changes the model straight away, just like NetLogo.
- The day and start time choose the real traffic. The model's clock starts one warm-up before the start time, so counting starts at it; the map toolbar, the run bar clock and the figures show the time in the model. Real traffic data shows the trips starting now and, once a minute has been counted, how many counted intersections are within GEH 5 of the SCATS counts.
- **Start** runs the model until **Pause**. **Step 1 second** pauses and moves on one second. **Simulation speed** sets how many seconds of traffic pass each real second; Max runs as fast as possible. Without Keep running, the model stops at the end of the counting time, like the desktop Go button. With Keep running, counting carries on until you pause.
- The map only shows real model seconds. Cars slide between the last two seconds so movement looks smooth; with reduced motion turned on, they jump instead. Looking at the model never changes its results.
- Closures take effect at once through the model's own procedures. Clicking a road chooses its street; with "Close roads by clicking" on, a click closes or reopens the road under the pointer. The Street and Which part lists do the same by keyboard. Closed streets are listed in words with a Reopen button.
- **Save baseline** uses the model's own checks: every road open, and at least one minute counted. The baseline is saved once, kept in the browser, and reused for every later run, across restarts, setting changes and reloads, until it is replaced or cleared. Every setting that differs from the baseline is listed next to the comparison.
- **Run results** use a still copy taken when the traffic pauses or stops. The baseline and the current run are compared at the same moment: the end of the shorter run. Averages only count trips that finish while counting. The page always shows finished, waiting, stranded and driving counts together. Results end with the counted intersections, busiest first: counted and simulated traffic, the difference and GEH.
- **Download CSV** uses the desktop export's columns and numbers.
- Every error explains what to do next. If the simulator fails to load, a Try again button appears. Status messages never move the keyboard focus.

## Security and speed

- There is no backend: the page and the model are static files. The page only loads files from its own address; a strict content security policy (set in `frontend/vite/securityHeaders.ts` and `vercel.json`) blocks everything else. There are no third-party scripts, fonts or trackers.
- The browser cannot send NetLogo code to the model. Only the listed settings and buttons are accepted, and every value is checked.
- Large files are compressed. Built files have content hashes and are cached for a year; the page and simulation files are re-checked on each visit.
- The simulation runs in a background thread and the map is drawn on a canvas, so the page stays at 60 frames per second even with nearly 2,000 cars.
