"""Build the desktop NetLogo model file from its source code.

This takes the model code in code/combined.nls, adds the interface (buttons,
sliders, switches, choosers, monitors and the map view) and the Info tab, and
writes "Melbourne Traffic Combined.nlogox" next to the data folder.

The turtle and link shapes are copied from the original Hoddle Grid model so the
desktop model looks the same as the team's prototype.

Run it from anywhere:  python3 simulation/netlogo/tools/build.py
"""

from pathlib import Path
import xml.etree.ElementTree as ElementTree


NETLOGO_FOLDER = Path(__file__).resolve().parent.parent
MODEL_FILE = NETLOGO_FOLDER / "Melbourne Traffic Combined.nlogox"
SOURCE_CODE = NETLOGO_FOLDER / "code" / "combined.nls"
ORIGINAL_MODEL = NETLOGO_FOLDER / "originals" / "Hoddle_Grid_Traffic.nlogox"


INFO = """## COMBINED MELBOURNE TRAFFIC LAB
Combines the supplied Hoddle Grid lane-based traffic engine with our cached real OpenStreetMap map of the Melbourne CBD and real traffic from Victoria's public SCATS counts. Both source models are preserved in originals/.

## QUICK START
Choose day-type (Weekday or Weekend) and start-time, click Setup, then Go / pause. The clock starts one warm-up before the start time, so counting begins at it. Click Choose street (Collins St is the initial selection) and Apply closure, or enable Click roads and click a road. Closed directions are red; reduced lanes magenta. Reopen selected or Reopen all restores capacity, including lanes.

All closures accumulate. Choose section narrows the scope; section 0 means whole street. Section numbers identify collapsed geometry chains between topology/attribute changes, not city block numbers. Clicking chooses the nearest polyline, not its straight chord. East / north applies to links with heading in [315,360) or [0,135). A lane reduction on a one-lane road fully closes that direction. Existing vehicles drain out; new vehicles avoid closed directions. Closed lanes drain; lanes do not merge mid-link.

## REAL DATA
Streets, one-way rules and available lane and speed tags come from OpenStreetMap, including King St and Wurundjeri Way. Traffic lights stand only at the DTP signalised intersections matched to the map. Trips start and end where real roads cross the edge of the map and at OpenStreetMap public car parks; P marks a car park. For each hour of an average weekday or weekend day in August 2026, the number of trips between those places was estimated so that the model's routes reproduce the SCATS counts at the intersections whose detectors cover every approach lane. Within the hour, trips follow the 15-minute counts. The SCATS match monitor shows the share of those intersections where the simulated traffic is within GEH 5 of the counts for the same stretch of the day. See docs/data-and-limitations.md and data/observed/summary.json. Data © Department of Transport and Planning, Victoria, CC BY 4.0.

## BASELINE
Run with no closures, wait through warm-up plus at least 60 seconds of measurement, Save baseline, then Setup and apply closures. The baseline survives Setup only with matching configuration; changing the day, time or signal/measurement settings clears it. Change-vs-baseline is grey until a baseline is saved. Demand generation uses an independent tick-seeded random stream, so baseline and closure runs receive the same arrivals and trips with the same seed. Travel-time averages include trips completed in the measurement window, even if they started in warm-up. Always compare waiting, stranded, active and completed counts together. CSV is written beside the model as combined-link-results.csv.

## LIMITS
This is an exploratory traffic simulation, not a forecast or safety assessment. SCATS counts do not say which way vehicles travel, so the trip pattern is one of many that reproduce the counts. Traffic light timings are not published in the data. With adaptive-signals? on (the default), each intersection splits its green time between east-west and north-south by the cars waiting at the start of every cycle, as SCATS adapts to demand; cycle-length and signal-coordination remain assumed, and ew-green-share applies only when adaptive-signals? is off. There are no turn restrictions, time-dependent access, parking capacities, trams, buses, cyclists or pedestrians, and OpenStreetMap lane counts can be lower than the real ones. Movement carries overshoot to the next link but advances at most one link per second. Continuous congestion-based route choice may produce loops; road closures can strand trips. Setup is required after changing the day, time, speed, signal plans or random seed.

## CREDITS
Hoddle Grid Traffic prototype supplied by the user's groupmate; its Info tab credits Wilensky (2003), NetLogo Traffic Grid. Original files are preserved. Real-map data © OpenStreetMap contributors, https://www.openstreetmap.org/copyright ; ODbL https://opendatacommons.org/licenses/odbl/1-0/ . Public extract downloaded 2026-09-29. Traffic data © Department of Transport and Planning, Victoria, CC BY 4.0. Runtime is offline.
"""

LEGEND = (
    "Red thick = closed | Magenta = lane reduced\n"
    "P = car park | Grey squares = roads into the map\n"
    "Choose a day and time, then Setup. Closures can be changed live."
)

# Every quarter-hour of the day, as the start-time chooser offers them.
START_TIMES = ["%02d:%02d" % (minutes // 60, minutes % 60) for minutes in range(0, 24 * 60, 15)]


class Interface:
    """Collects the widgets of the NetLogo interface, in the order NetLogo lists them."""

    def __init__(self, parent):
        self.widgets = ElementTree.SubElement(parent, "widgets")

    def add(self, tag, **attributes):
        values = {}
        for key, value in attributes.items():
            values[key] = str(value)
        return ElementTree.SubElement(self.widgets, tag, values)

    def button(self, text, code, x, y, width=145, forever=False):
        if code == "setup":
            wait_for_setup = "false"
        else:
            wait_for_setup = "true"
        widget = self.add(
            "button",
            x=x,
            y=y,
            width=width,
            height=36,
            forever=str(forever).lower(),
            kind="Observer",
            disableUntilTicks=wait_for_setup,
            display=text,
        )
        widget.text = code

    def slider(self, variable, x, y, width, default, low, high, step):
        self.add(
            "slider",
            x=x,
            y=y,
            width=width,
            height=48,
            display=variable,
            variable=variable,
            min=low,
            max=high,
            step=step,
            default=default,
            direction="Horizontal",
        )

    def switch(self, variable, x, y, width, on):
        self.add("switch", x=x, y=y, width=width, height=38, display=variable, variable=variable, on=str(on).lower())

    def chooser(self, variable, choices, x, y, width, current=0):
        widget = self.add(
            "chooser", x=x, y=y, width=width, height=58, display=variable, variable=variable, current=current
        )
        for value in choices:
            ElementTree.SubElement(widget, "choice", type="string", value=value)

    def monitor(self, text, expression, x, y, width):
        widget = self.add("monitor", x=x, y=y, width=width, height=52, display=text, precision=1, fontSize=11)
        widget.text = expression


def build_interface(ui):
    # Run buttons, top left.
    ui.button("Setup", "setup", 10, 10)
    ui.button("Go / pause", "go", 165, 10, forever=True)
    ui.button("Click roads", "click-to-close", 10, 52, forever=True)
    ui.button("Step 1 second", "go", 165, 52)

    # Scenario sliders down the left side.
    sliders = [
        ("informed-drivers-%", 100, 50, 0, 100, 5),
        ("speed-limit-kmh", 150, 40, 20, 60, 5),
        ("cycle-length", 200, 80, 40, 150, 5),
        ("ew-green-share", 250, 50, 20, 80, 5),
        ("warm-up-s", 300, 600, 0, 900, 30),
        ("measure-s", 350, 600, 60, 3600, 60),
        ("seed", 400, 42, 1, 100, 1),
        ("reroute-interval", 450, 60, 10, 300, 10),
        ("route-noise", 500, 0.1, 0, 0.5, 0.05),
    ]
    for variable, y, default, low, high, step in sliders:
        ui.slider(variable, 10, y, 300, default, low, high, step)

    ui.switch("fixed-seed?", 10, 555, 145, True)
    ui.switch("adaptive-signals?", 165, 555, 145, True)
    ui.switch("close-whole-street?", 10, 598, 300, True)

    ui.chooser("signal-coordination", ["random offsets", "green wave (east-west)"], 10, 642, 300)
    ui.chooser("day-type", ["Weekday", "Weekend"], 330, 10, 140)
    ui.chooser("start-time", START_TIMES, 480, 10, 140, START_TIMES.index("08:00"))
    ui.chooser("view-mode", ["congestion", "volume", "change vs baseline"], 630, 10, 270)

    ui.button("Save baseline", "save-baseline", 915, 20, 180)
    ui.button("Export CSV", "export-link-results", 1105, 20, 180)

    ui.add(
        "view",
        x=330,
        y=184,
        width=725,
        height=617,
        minPxcor=-120,
        maxPxcor=120,
        minPycor=-102,
        maxPycor=102,
        patchSize=3,
        fontSize=10,
        wrappingAllowedX="false",
        wrappingAllowedY="false",
        showTickCounter="true",
        tickCounterLabel="seconds",
        frameRate=30,
        updateMode=1,
    )

    # Closure controls above the map.
    ui.button("Choose street", "choose-street", 330, 82)
    ui.button("Choose section", "choose-section", 485, 82)
    ui.chooser(
        "closure-type",
        ["Both directions", "East / north direction", "One lane each direction"],
        1085,
        76,
        210,
    )
    ui.button("Apply closure", "close-selection", 640, 82)
    ui.button("Reopen selected", "reopen-selection", 795, 82)
    ui.button("Reopen all", "reopen-all", 950, 82, 125)
    ui.switch("scheduled-closure?", 330, 812, 220, False)
    ui.slider("closure-start-min", 565, 806, 235, 2, 0, 60, 1)

    # Monitors down the right side.
    monitors = [
        ("Cars", "count cars"),
        ("Waiting to enter", "queued-at-gates"),
        ("Completed", "trips-done"),
        ("Mean trip / min", "mean-trip-time-min"),
        ("Stranded", "stranded-count"),
        ("Elapsed / sec", "ticks"),
    ]
    for index, (title, expression) in enumerate(monitors):
        ui.monitor(title, expression, 1070, 140 + index * 57, 225)
    ui.monitor("Selected extent", "selection-label", 330, 124, 730)
    ui.monitor("Closures", "closure-desc", 1070, 486, 225)

    # The real traffic, under the settings on the left.
    ui.monitor("Time of day", "clock-label", 10, 710, 145)
    ui.monitor("Trips per hour now", "round trips-per-hour-now", 165, 710, 145)
    ui.monitor("SCATS match (GEH < 5)", "scats-match", 10, 767, 300)

    ui.add("output", x=1070, y=546, width=225, height=252, fontSize=11)

    legend = ui.add(
        "note",
        x=815,
        y=806,
        width=480,
        height=65,
        fontSize=11,
        markdown="false",
        textColorLight=-16777216,
        textColorDark=-1,
        backgroundLight=0,
        backgroundDark=0,
    )
    legend.text = LEGEND


def main():
    original = ElementTree.parse(ORIGINAL_MODEL).getroot()

    model = ElementTree.Element("model", version="NetLogo 7.0.4", snapToGrid="true")
    ElementTree.SubElement(model, "code").text = SOURCE_CODE.read_text()
    interface = Interface(model)
    build_interface(interface)
    ElementTree.SubElement(model, "info").text = INFO
    for name in ["turtleShapes", "linkShapes"]:
        model.append(original.find(name))
    ElementTree.SubElement(model, "previewCommands").text = "setup\nrepeat 120 [go]"

    ElementTree.indent(model)
    ElementTree.ElementTree(model).write(MODEL_FILE, encoding="utf-8", xml_declaration=True)
    print("Built", MODEL_FILE.name)


if __name__ == "__main__":
    main()
